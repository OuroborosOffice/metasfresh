package de.metas.ui.web.order.purchase.view;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

import org.adempiere.ad.dao.IQueryBL;
import org.adempiere.util.Services;
import org.compiere.model.I_C_BPartner;
import org.compiere.model.I_C_OrderLine;
import org.compiere.model.I_M_Product;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.cache.RemovalNotification;
import com.google.common.collect.ImmutableList;

import de.metas.purchasing.api.IBPartnerProductDAO;
import de.metas.ui.web.exceptions.EntityNotFoundException;
import de.metas.ui.web.handlingunits.OLCandRowId;
import de.metas.ui.web.view.CreateViewRequest;
import de.metas.ui.web.view.IView;
import de.metas.ui.web.view.IViewFactory;
import de.metas.ui.web.view.IViewsIndexStorage;
import de.metas.ui.web.view.ViewCloseReason;
import de.metas.ui.web.view.ViewFactory;
import de.metas.ui.web.view.ViewId;
import de.metas.ui.web.view.descriptor.ViewLayout;
import de.metas.ui.web.view.json.JSONViewDataType;
import de.metas.ui.web.window.datatypes.WindowId;
import de.metas.ui.web.window.datatypes.json.JSONLookupValue;

/*
 * #%L
 * metasfresh-webui-api
 * %%
 * Copyright (C) 2017 metas GmbH
 * %%
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as
 * published by the Free Software Foundation, either version 2 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/gpl-2.0.html>.
 * #L%
 */

@ViewFactory(windowId = SalesOrderToOLCandViewFactory.WINDOW_ID_STRING)
public class SalesOrderToOLCandViewFactory implements IViewFactory, IViewsIndexStorage
{
	public static final String WINDOW_ID_STRING = "SO2OLCand";
	public static final WindowId WINDOW_ID = WindowId.fromJson(WINDOW_ID_STRING);

	private final Cache<ViewId, OLCandView> views = CacheBuilder.newBuilder()
			.expireAfterAccess(1, TimeUnit.HOURS)
			.removalListener(notification -> onViewRemoved(notification))
			.build();

	@Override
	public WindowId getWindowId()
	{
		return WINDOW_ID;
	}

	@Override
	public ViewLayout getViewLayout(final WindowId windowId, final JSONViewDataType viewDataType)
	{
		return ViewLayout.builder()
				.setWindowId(windowId)
				//
				.setHasAttributesSupport(false)
				.setHasTreeSupport(true)
				//
				.addElementsFromViewRowClass(OLCandRow.class, viewDataType)
				//
				.build();
	}

	@Override
	public void put(final IView view)
	{
		views.put(view.getViewId(), OLCandView.cast(view));
	}

	@Override
	public OLCandView getByIdOrNull(final ViewId viewId)
	{
		return views.getIfPresent(viewId);
	}

	public OLCandView getById(final ViewId viewId)
	{
		final OLCandView view = getByIdOrNull(viewId);
		if (view == null)
		{
			throw new EntityNotFoundException("View " + viewId + " was not found");
		}
		return view;
	}

	@Override
	public void removeById(final ViewId viewId)
	{
		views.invalidate(viewId);
		views.cleanUp(); // also cleanup to prevent views cache to grow.
	}

	private final void onViewRemoved(final RemovalNotification<Object, Object> notification)
	{
		final OLCandView view = OLCandView.cast(notification.getValue());
		final ViewCloseReason closeReason = ViewCloseReason.fromCacheEvictedFlag(notification.wasEvicted());
		view.close(closeReason);
	}

	@Override
	public Stream<IView> streamAllViews()
	{
		return Stream.empty();
	}

	@Override
	public void invalidateView(final ViewId viewId)
	{
		final IView view = getByIdOrNull(viewId);
		if (view == null)
		{
			return;
		}

		view.invalidateAll();
	}

	@Override
	public OLCandView createView(final CreateViewRequest request)
	{
		return createView(OLCandViewCreateRequest.builder()
				.salesOrderLineIds(request.getFilterOnlyIds())
				.build());
	}

	private OLCandView createView(final OLCandViewCreateRequest request)
	{
		final OLCandView view = OLCandView.builder()
				.viewId(ViewId.random(WINDOW_ID))
				.rowsSupplier(() -> retrieveRows(request))
				.build();

		return view;
	}

	private List<OLCandRow> retrieveRows(final OLCandViewCreateRequest request)
	{
		return Services.get(IQueryBL.class)
				.createQueryBuilder(I_C_OrderLine.class)
				.addInArrayFilter(I_C_OrderLine.COLUMNNAME_C_OrderLine_ID, request.getSalesOrderLineIds())
				.create()
				.stream(I_C_OrderLine.class)
				.map(this::createOLCandRow)
				.collect(ImmutableList.toImmutableList());
	}

	private OLCandRow createOLCandRow(final I_C_OrderLine salesOrderLine)
	{
		final int salesOrderLineId = salesOrderLine.getC_OrderLine_ID();
		final JSONLookupValue product = createProductLookupValue(salesOrderLine.getM_Product());
		final BigDecimal qtyToDeliver = salesOrderLine.getQtyOrdered().subtract(salesOrderLine.getQtyDelivered());
		final Timestamp datePromised = salesOrderLine.getDatePromised();

		final ImmutableList<OLCandRow> olCandRows = Services.get(IBPartnerProductDAO.class)
				.retrieveAllVendors(salesOrderLine.getM_Product_ID(), salesOrderLine.getAD_Org_ID())
				.stream()
				.map(vendorProductInfo -> OLCandRow.builder()
						.rowId(OLCandRowId.lineId(salesOrderLineId, vendorProductInfo.getC_BPartner_ID()))
						.rowType(OLCandRowType.LINE)
						.product(product)
						.datePromised(salesOrderLine.getDatePromised())
						.qtyToPurchase(BigDecimal.ZERO)
						.vendorBPartner(createBPartnerLookupValue(vendorProductInfo.getC_BPartner()))
						.build())
				.collect(ImmutableList.toImmutableList());

		final OLCandRow orderLineGrouppingRow = OLCandRow.builder()
				.rowId(OLCandRowId.groupId(salesOrderLineId))
				.rowType(OLCandRowType.GROUP)
				.product(product)
				.qtyToDeliver(qtyToDeliver)
				.qtyToPurchase(BigDecimal.ZERO)
				.datePromised(datePromised)
				.includedRows(olCandRows)
				.build();

		return orderLineGrouppingRow;
	}

	private static JSONLookupValue createProductLookupValue(final I_M_Product product)
	{
		if (product == null)
		{
			return null;
		}

		final String displayName = product.getValue() + "_" + product.getName();
		return JSONLookupValue.of(product.getM_Product_ID(), displayName);
	}

	private static JSONLookupValue createBPartnerLookupValue(final I_C_BPartner bpartner)
	{
		if (bpartner == null)
		{
			return null;
		}

		final String displayName = bpartner.getValue() + "_" + bpartner.getName();
		return JSONLookupValue.of(bpartner.getC_BPartner_ID(), displayName);
	}

}
