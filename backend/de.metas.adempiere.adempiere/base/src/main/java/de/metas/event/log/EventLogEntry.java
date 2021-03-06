package de.metas.event.log;

import java.util.UUID;

import de.metas.error.AdIssueId;
import lombok.Builder;
import lombok.Builder.Default;
import lombok.NonNull;
import lombok.Value;

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
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public
 * License along with this program.  If not, see
 * <http://www.gnu.org/licenses/gpl-2.0.html>.
 * #L%
 */

@Value
@Builder
public class EventLogEntry
{
	@NonNull
	UUID uuid;

	@Default
	boolean processed = false;

	@Default
	boolean error = false;

	AdIssueId adIssueId;

	@NonNull
	Integer clientId;

	@NonNull
	Integer orgId;

	String message;
	Class<?> eventHandlerClass;

	public String getEventHandlerClassName()
	{
		return eventHandlerClass != null ? eventHandlerClass.getName() : null;
	}
}
