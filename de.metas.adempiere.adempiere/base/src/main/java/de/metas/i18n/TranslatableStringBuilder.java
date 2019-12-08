package de.metas.i18n;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;

import org.compiere.util.DisplayType;

import com.google.common.base.MoreObjects;

import de.metas.currency.Amount;
import de.metas.util.Check;
import de.metas.util.Services;
import lombok.NonNull;

/*
 * #%L
 * de.metas.adempiere.adempiere.base
 * %%
 * Copyright (C) 2018 metas GmbH
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

public final class TranslatableStringBuilder
{
	static TranslatableStringBuilder newInstance()
	{
		return new TranslatableStringBuilder();
	}

	// services
	private final IMsgBL msgBL = Services.get(IMsgBL.class);

	private static final String EMPTY_JOIN_STRING = "";

	private final List<ITranslatableString> parts = new ArrayList<>();
	private StringBuilder lastStringBuffer;

	private TranslatableStringBuilder()
	{
	}

	/**
	 * Use {@link #build()} instead.
	 */
	@Override
	@Deprecated
	public String toString()
	{
		return MoreObjects.toStringHelper(this).addValue(parts).toString();
	}

	public ITranslatableString build()
	{
		appendLastStringBuffer();

		if (parts.isEmpty())
		{
			return TranslatableStrings.empty();
		}
		else if (parts.size() == 1)
		{
			return parts.get(0);
		}
		else
		{
			return new CompositeTranslatableString(parts, EMPTY_JOIN_STRING);
		}
	}

	public boolean isEmpty()
	{
		return parts.isEmpty();
	}

	public TranslatableStringBuilder append(final ITranslatableString value)
	{
		if (value == null)
		{
			return this;
		}

		appendLastStringBuffer();

		parts.add(value);
		return this;
	}

	private void appendLastStringBuffer()
	{
		if (lastStringBuffer == null)
		{
			return;
		}

		if (lastStringBuffer.length() > 0)
		{
			parts.add(TranslatableStrings.constant(lastStringBuffer.toString()));
		}

		lastStringBuffer = null;
	}

	public TranslatableStringBuilder appendObj(final Object obj)
	{
		if (obj == null)
		{
			return append("null");
		}
		else if (obj instanceof ITranslatableString)
		{
			return append((ITranslatableString)obj);
		}
		// TODO: handle more types, like date, integer, BigDecimal etc
		else
		{
			return append(String.valueOf(obj));
		}
	}

	public TranslatableStringBuilder insertFirst(final ITranslatableString value)
	{
		if (TranslatableStrings.isEmpty(value))
		{
			return this;
		}

		parts.add(0, value);
		return this;
	}

	public TranslatableStringBuilder insertFirst(final String value)
	{
		return insertFirst(TranslatableStrings.constant(value));
	}

	public TranslatableStringBuilder append(final String value)
	{
		if (Check.isEmpty(value))
		{
			return this;
		}

		if (lastStringBuffer == null)
		{
			lastStringBuffer = new StringBuilder();
		}
		lastStringBuffer.append(value);

		return this;
		// return append(ConstantTranslatableString.of(value));
	}

	public TranslatableStringBuilder append(@NonNull final BigDecimal value, final int displayType)
	{
		return append(NumberTranslatableString.of(value, displayType));
	}

	public TranslatableStringBuilder append(@NonNull final Amount amount)
	{
		return append(NumberTranslatableString.of(amount.getAsBigDecimal(), DisplayType.Amount))
				.append(" ")
				.append(amount.getCurrencyCode().toThreeLetterCode());
	}

	public TranslatableStringBuilder append(final int value)
	{
		return append(NumberTranslatableString.of(value));
	}

	public TranslatableStringBuilder appendDate(final Date value)
	{
		return append(DateTimeTranslatableString.ofDate(value));
	}

	public TranslatableStringBuilder appendDate(final LocalDate value)
	{
		return append(TranslatableStrings.date(value));
	}

	public TranslatableStringBuilder appendDateTime(final Date value)
	{
		return append(TranslatableStrings.dateAndTime(value));
	}

	public TranslatableStringBuilder appendDateTime(final Instant value)
	{
		return append(DateTimeTranslatableString.ofDateTime(value));
	}

	public TranslatableStringBuilder appendTimeZone(@NonNull final ZoneId zoneId, @NonNull final TextStyle textStyle)
	{
		return append(TimeZoneTranslatableString.ofZoneId(zoneId, textStyle));
	}

	public TranslatableStringBuilder append(final Boolean value)
	{
		if (value == null)
		{
			return append("?");
		}
		else
		{
			return append(msgBL.getTranslatableMsgText(value));
		}
	}

	public TranslatableStringBuilder appendADMessage(final String adMessage, final Object... msgParameters)
	{
		final ITranslatableString value = msgBL.getTranslatableMsgText(adMessage, msgParameters);
		return append(value);
	}

	public TranslatableStringBuilder insertFirstADMessage(final String adMessage, final Object... msgParameters)
	{
		final ITranslatableString value = msgBL.getTranslatableMsgText(adMessage, msgParameters);
		return insertFirst(value);
	}

	public TranslatableStringBuilder appendADElement(final String columnName)
	{
		final ITranslatableString value = msgBL.translatable(columnName);
		return append(value);
	}

}
