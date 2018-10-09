DROP FUNCTION IF EXISTS de_metas_endcustomer_fresh_reports.Docs_Sales_InOut_Details ( IN Record_ID numeric, IN AD_Language Character Varying (6) );
DROP TABLE IF EXISTS de_metas_endcustomer_fresh_reports.Docs_Sales_InOut_Details;

CREATE TABLE de_metas_endcustomer_fresh_reports.Docs_Sales_InOut_Details
(
	Line Numeric (10,0),
	Name Character Varying,
	Attributes Text,
	HUQty Numeric,
	HUName Text,
	qtyEntered Numeric,
	PriceEntered Numeric,
	UOMSymbol Character Varying (10),
	StdPrecision Numeric (10,0),
	LineNetAmt Numeric,
	Discount Numeric,
	IsDiscountPrinted Character (1),
	QtyPattern text
);


CREATE FUNCTION de_metas_endcustomer_fresh_reports.Docs_Sales_InOut_Details ( IN Record_ID numeric, IN AD_Language Character Varying (6) )
RETURNS SETOF de_metas_endcustomer_fresh_reports.Docs_Sales_InOut_Details AS
$$

SELECT
	iol.line,
	COALESCE(pt.Name, p.name) AS Name,
	CASE WHEN Length( att.Attributes ) > 15
		THEN att.Attributes || E'\n'
		ELSE att.Attributes
	END AS Attributes,
	iol.QtyEnteredTU AS HUQty,
	pi.name AS HUName,
	QtyEntered * COALESCE (multiplyrate, 1) AS QtyEntered,
	COALESCE(ic.PriceEntered_Override, ic.PriceEntered) AS PriceEntered,
	COALESCE(uomt.UOMSymbol, uom.UOMSymbol) AS UOMSymbol,
	uom.stdPrecision,
	COALESCE(ic.PriceActual_Override, ic.PriceActual) * iol.MovementQty * COALESCE (multiplyrate, 1) AS linenetamt,
	COALESCE(ic.Discount_Override, ic.Discount) AS Discount,
	bp.isDiscountPrinted,
	CASE WHEN StdPrecision = 0 THEN '#,##0' ELSE Substring( '#,##0.000' FROM 0 FOR 7+StdPrecision::integer) END AS QtyPattern
FROM
	M_InOutLine iol
	INNER JOIN M_InOut io 			ON iol.M_InOut_ID = io.M_InOut_ID
	LEFT OUTER JOIN C_BPartner bp			ON io.C_BPartner_ID = bp.C_BPartner_ID
	LEFT OUTER JOIN (
		SELECT 	AVG(ic.PriceEntered_Override) AS PriceEntered_Override, AVG(ic.PriceEntered) AS PriceEntered,
			AVG(ic.PriceActual_Override) AS PriceActual_Override, AVG(ic.PriceActual) AS PriceActual,
			AVG(ic.Discount_Override) AS Discount_Override, AVG(ic.Discount) AS Discount, Price_UOM_ID, iciol.M_InOutLine_ID
		FROM 	C_InvoiceCandidate_InOutLine iciol
			INNER JOIN C_Invoice_Candidate ic ON iciol.C_Invoice_Candidate_ID = ic.C_Invoice_Candidate_ID
			INNER JOIN M_InOutLine iol ON iol.M_InOutLine_ID = iciol.M_InOutLine_ID
		WHERE iol.M_InOut_ID = $1
		GROUP BY 	Price_UOM_ID, iciol.M_InOutLine_ID
	) ic ON iol.M_InOutLine_ID = ic.M_InOutLine_ID
	-- Get Packing instruction
	LEFT OUTER JOIN
	(
		SELECT String_Agg( DISTINCT name, E'\n' ORDER BY name ) AS Name, M_InOutLine_ID
		FROM
			(
				SELECT DISTINCT
					-- 08604 - in IT1 only one PI was shown though 2 were expected. Only the fallback can do this, so we use it first
					COALESCE ( pifb.name, pi.name ) AS name,
					iol.M_InOutLine_ID
				FROM
					M_InOutLine iol
					-- Get PI directly from InOutLine (1 to 1) 
					LEFT OUTER JOIN M_HU_PI_Item_Product pi ON iol.M_HU_PI_Item_Product_ID = pi.M_HU_PI_Item_Product_ID AND pi.isActive = 'Y'
					-- Get PI from HU assignments (1 to n)
					LEFT OUTER JOIN M_HU_Assignment asgn ON asgn.AD_Table_ID = ((SELECT get_Table_ID( 'M_InOutLine' ) ))
						AND asgn.Record_ID = iol.M_InOutLine_ID
					LEFT OUTER JOIN M_HU tu ON asgn.M_TU_HU_ID = tu.M_HU_ID
					LEFT OUTER JOIN M_HU_PI_Item_Product pifb ON tu.M_HU_PI_Item_Product_ID = pifb.M_HU_PI_Item_Product_ID AND pifb.isActive = 'Y'
				WHERE
					COALESCE ( pi.name, pifb.name ) != 'VirtualPI'
					AND iol.M_InOut_ID = $1
			) x
		GROUP BY M_InOutLine_ID
	) pi ON iol.M_InOutLine_ID = pi.M_InOutLine_ID
	-- Product and its translation
	LEFT OUTER JOIN M_Product p 			ON iol.M_Product_ID = p.M_Product_ID
	LEFT OUTER JOIN M_Product_Trl pt 		ON iol.M_Product_ID = pt.M_Product_ID AND pt.AD_Language = $2
	LEFT OUTER JOIN M_Product_Category pc 		ON p.M_Product_Category_ID = pc.M_Product_Category_ID
	-- Unit of measurement and its translation
	LEFT OUTER JOIN C_UOM uom			ON ic.Price_UOM_ID = uom.C_UOM_ID
	LEFT OUTER JOIN C_UOM_Trl uomt			ON ic.Price_UOM_ID = uomt.C_UOM_ID AND uomt.AD_Language = $2
	LEFT OUTER JOIN C_UOM_Conversion conv		ON conv.C_UOM_ID = iol.C_UOM_ID
		AND conv.C_UOM_To_ID = ic.Price_UOM_ID
		AND iol.M_Product_ID = conv.M_Product_ID
		AND conv.isActive = 'Y'
	-- Attributes
	LEFT OUTER JOIN	(
		SELECT 	String_agg ( at.ai_value, ', ' ORDER BY Length(at.ai_value), at.ai_value ) AS Attributes, at.M_AttributeSetInstance_ID FROM Report.fresh_Attributes at
		JOIN M_InOutLine iol ON at.M_AttributeSetInstance_ID = iol.M_AttributeSetInstance_ID
		WHERE	at.at_value IN ('1000002', '1000001', '1000030', '1000015') -- Label, Herkunft, Aktionen, Marke (ADR)
			AND iol.M_InOut_ID = $1
		GROUP BY	at.M_AttributeSetInstance_ID
	) att ON iol.M_AttributeSetInstance_ID = att.M_AttributeSetInstance_ID
WHERE
	iol.M_InOut_ID = $1
	AND pc.M_Product_Category_ID != (SELECT value::numeric FROM AD_SysConfig WHERE name = 'PackingMaterialProductCategoryID')
	AND QtyEntered != 0 -- Don't display lines without a Qty. See 08293
ORDER BY
	line

$$
LANGUAGE sql STABLE
;