import update from 'immutability-helper';
// import { is } from 'immutable';
// import * as _ from 'lodash';
import React, { PureComponent } from 'react';
import onClickOutside from 'react-onclickoutside';
// import { connect } from 'react-redux';
import classnames from 'classnames';
import currentDevice from 'current-device';
import counterpart from 'counterpart';
// import uuid from 'uuid/v4';

import { updateTableSelection } from '../../actions/TableActions';
// import { deleteRequest } from '../../actions/GenericActions';
import {
  getTableId,
  getTable } from '../../reducers/tables';
import {
  // deleteLocal,
  // openModal,
  // selectTableItems,
  deselectTableItems,
} from '../../actions/WindowActions';
// import { getZoomIntoWindow } from '../../api';
import {
  getSizeClass,
  handleCopy,
  handleOpenNewTab,
  componentPropTypes,
  constructorFn,
} from '../../utils/tableHelpers';
import {
  // getRowsData,
  mapIncluded,
  collapsedMap,
} from '../../utils/documentListHelper';

import Prompt from '../app/Prompt';
import DocumentListContextShortcuts from '../keyshortcuts/DocumentListContextShortcuts';
import TableContextShortcuts from '../keyshortcuts/TableContextShortcuts';
import TableContextMenu from './TableContextMenu';
import TableFilter from './TableFilter';
import TableHeader from './TableHeader';
import TableItem from './TableItem';
import TablePagination from './TablePagination';

const MOBILE_TABLE_SIZE_LIMIT = 30; // subjective number, based on empiric testing
const isMobileOrTablet =
  currentDevice.type === 'mobile' || currentDevice.type === 'tablet';
// const EMPTY_ARRAY = [];

let RENDERS = 0;

class Table extends PureComponent {
  _isMounted = false;

  constructor(props) {
    super(props);

    const constr = constructorFn.bind(this);
    constr(props);
  }

  componentDidMount() {
    this._isMounted = true;

    if (this.props.autofocus) {
      this.table.focus();
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  getAllLeafs = () => {
    const { rows, selected, onSelectRange } = this.props;
    let leafs = [];
    let leafsIds = [];

    rows.map((item) => {
      if (item.id === selected[0]) {
        leafs = mapIncluded(item);
      }
    });

    leafs.map((item) => {
      leafsIds = leafsIds.concat(item.id);
    });

    onSelectRange(leafsIds);
  };

  setListenTrue = () => {
    this.setState({ listenOnKeys: true });
  };

  setListenFalse = () => {
    this.setState({ listenOnKeys: false });
  };

  triggerFocus = (idFocused, idFocusedDown) => {
    if (this.table) {
      const rowSelected = this.table.getElementsByClassName('row-selected');

      if (rowSelected.length > 0) {
        if (typeof idFocused == 'number') {
          rowSelected[0].children[idFocused].focus();
        }
        if (typeof idFocusedDown == 'number') {
          rowSelected[rowSelected.length - 1].children[idFocusedDown].focus();
        }
      }
    }
  };

  handleClickOutside = (event) => {
    const {
      showIncludedViewOnSelect,
      viewId,
      windowType,
      inBackground,
      allowOutsideClick,
      limitOnClickOutside,
      onDeselectAll,
    } = this.props;
    const parentNode = event.target.parentNode;
    const closeIncluded =
      limitOnClickOutside &&
      (parentNode.className.includes('document-list-wrapper') ||
        event.target.className.includes('document-list-wrapper'))
        ? parentNode.className.includes('document-list-has-included')
        : true;

    if (
      allowOutsideClick &&
      parentNode &&
      parentNode !== document &&
      !parentNode.className.includes('notification') &&
      !inBackground &&
      closeIncluded
    ) {
      const item = event.path || (event.composedPath && event.composedPath());

      if (item) {
        for (let i = 0; i < item.length; i++) {
          if (
            item[i].classList &&
            item[i].classList.contains('js-not-unselect')
          ) {
            return;
          }
        }
      } else if (parentNode.className.includes('js-not-unselect')) {
        return;
      }

      onDeselectAll();

      if (showIncludedViewOnSelect) {
        showIncludedViewOnSelect({
          showIncludedView: false,
          windowType,
          viewId,
        });
      }
    }
  };

  handleKeyDown = (e) => {
    const {
      keyProperty,
      mainTable,
      readonly,
      closeOverlays,
      selected,
      rows,
      onShowSelectedIncludedView,
      onSelect,
      onSelectOne,
    } = this.props;
    const { listenOnKeys, collapsedArrayMap } = this.state;

    if (!listenOnKeys) {
      return;
    }

    const selectRange = e.shiftKey;
    const nodeList = Array.prototype.slice.call(
      document.activeElement.parentElement.children
    );
    const idActive = nodeList.indexOf(document.activeElement);
    let idFocused = null;

    if (idActive > -1) {
      idFocused = idActive;
    }

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();

        const array =
          collapsedArrayMap.length > 0
            ? collapsedArrayMap.map((item) => item[keyProperty])
            : rows.map((item) => item[keyProperty]);
        const currentId = array.findIndex(
          (x) => x === selected[selected.length - 1]
        );

        if (currentId >= array.length - 1) {
          return;
        }

        if (!selectRange) {
          onSelectOne(
            array[currentId + 1],
            false,
            idFocused,
            onShowSelectedIncludedView([array[currentId + 1]])
          );
        } else {
          onSelect(array[currentId + 1], false, idFocused);
        }
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();

        const array =
          collapsedArrayMap.length > 0
            ? collapsedArrayMap.map((item) => item[keyProperty])
            : rows.map((item) => item[keyProperty]);
        const currentId = array.findIndex(
          (x) => x === selected[selected.length - 1]
        );

        if (currentId <= 0) {
          return;
        }

        if (!selectRange) {
          onSelectOne(
            array[currentId - 1],
            idFocused,
            false,
            onShowSelectedIncludedView([array[currentId - 1]])
          );
        } else {
          onSelect(array[currentId - 1], idFocused, false);
        }
        break;
      }
      case 'ArrowLeft':
        e.preventDefault();
        if (document.activeElement.previousSibling) {
          document.activeElement.previousSibling.focus();
        }
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (document.activeElement.nextSibling) {
          document.activeElement.nextSibling.focus();
        }
        break;
      case 'Tab':
        if (mainTable) {
          e.preventDefault();
          const focusedElem = document.getElementsByClassName(
            'js-attributes'
          )[0];
          if (focusedElem) {
            focusedElem.getElementsByTagName('input')[0].focus();
          }
          break;
        } else {
          if (e.shiftKey) {
            //passing focus over table cells backwards
            this.table.focus();
          } else {
            //passing focus over table cells
            this.tfoot.focus();
          }
        }
        break;
      case 'Enter':
        if (selected.length <= 1 && readonly) {
          e.preventDefault();

          this.handleDoubleClick(selected[selected.length - 1]);
        }
        break;
      case 'Escape':
        closeOverlays && closeOverlays();
        break;
    }
  };

  closeContextMenu = () => {
    this.setState({
      contextMenu: Object.assign({}, this.state.contextMenu, {
        open: false,
      }),
    });
  };

  handleDoubleClick = (id) => {
    const { isIncluded, onDoubleClick } = this.props;

    if (!isIncluded) {
      onDoubleClick && onDoubleClick(id);
    }
  };

  handleClick = (e, item) => {
    const {
      onSelectionChanged,
      openIncludedViewOnSelect,
      showIncludedViewOnSelect,
      keyProperty,
      updateQuickActions,
      selected,
      onSelect,
      onSelectOne,
      onSelectRange,
      onDeselect,
    } = this.props;
    const id = item[keyProperty];
    let selectionValue = false;

    if (e.button === 0) {
      const selectMore = e.metaKey || e.ctrlKey;
      const selectRange = e.shiftKey;
      const isSelected = selected.indexOf(id) > -1;
      const isAnySelected = selected.length > 0;

      let newSelection;

      if (selectMore || isMobileOrTablet) {
        if (isSelected) {
          newSelection = onDeselect(id);
        } else {
          newSelection = onSelect(id);
        }
      } else if (selectRange) {
        if (isAnySelected) {
          newSelection = this.getProductRange(id);
          onSelectRange(newSelection);
        } else {
          newSelection = [id];
          onSelectOne(id);
        }
      } else {
        updateQuickActions && updateQuickActions(id);
        newSelection = [id];
        onSelectOne(id);
      }

      if (onSelectionChanged) {
        onSelectionChanged(newSelection);
      }

      selectionValue = newSelection.length > 0;
    }
    selectionValue = true;

    if (openIncludedViewOnSelect) {
      showIncludedViewOnSelect({
        showIncludedView: selectionValue && item.supportIncludedViews,
        forceClose: !selectionValue,
        windowType: item.supportIncludedViews
          ? item.includedView.windowType || item.includedView.windowId
          : null,
        viewId: item.supportIncludedViews ? item.includedView.viewId : '',
      });
    }
  };

  handleRightClick = (e, id, fieldName, supportZoomInto, supportFieldEdit) => {
    e.preventDefault();

    const { selected, onSelectOne } = this.props;
    const { clientX, clientY } = e;

    if (selected.indexOf(id) > -1) {
      this.setContextMenu(
        clientX,
        clientY,
        fieldName,
        supportZoomInto,
        supportFieldEdit
      );
    } else {
      onSelectOne(id, null, null, () => {
        this.setContextMenu(
          clientX,
          clientY,
          fieldName,
          supportZoomInto,
          supportFieldEdit
        );
      });
    }
  };

  setContextMenu = (
    clientX,
    clientY,
    fieldName,
    supportZoomInto,
    supportFieldEdit
  ) => {
    this.setState({
      contextMenu: Object.assign({}, this.state.contextMenu, {
        x: clientX,
        y: clientY,
        open: true,
        fieldName,
        supportZoomInto,
        supportFieldEdit,
      }),
    });
  };

  getProductRange = (id) => {
    const { keyProperty, rows, selected } = this.props;
    let arrayIndex;
    let selectIdA;
    let selectIdB;

    arrayIndex = rows.map((item) => item[keyProperty]);
    selectIdA = arrayIndex.findIndex((x) => x === id);
    selectIdB = arrayIndex.findIndex((x) => x === selected[0]);

    const selectedArr = [selectIdA, selectIdB];

    selectedArr.sort((a, b) => a - b);
    return arrayIndex.slice(selectedArr[0], selectedArr[1] + 1);
  };

  handleBatchEntryToggle = () => {
    const { isBatchEntry } = this.state;

    this.setState({
      isBatchEntry: !isBatchEntry,
    });
  };

  handleDelete = () => {
    this.setState({
      promptOpen: true,
    });
  };

  handlePromptCancelClick = () => {
    this.setState({
      promptOpen: false,
    });
  };

  handlePromptSubmitClick = (selected) => {
    const { onPromptSubmit } = this.props;

    onPromptSubmit && onPromptSubmit(selected);

    this.setState({ promptOpen: false });
  };

  handleShortcutIndent = (expand) => {
    const {
      keyProperty,
      selected,
      rows,
      collapsedParentsRows,
      onRowCollapse,
    } = this.props;
    let node = null;
    let isCollapsed = false;

    selected.length === 1 &&
      rows.map((item) => {
        if (item.id === selected[0]) {
          if (item.includedDocuments) {
            const keyProp = item[keyProperty];

            node = item;
            isCollapsed = collapsedParentsRows.indexOf(keyProp) > -1;
          }
        }
      });

    if (node) {
      if (isCollapsed && expand) {
        onRowCollapse(node, expand);
      } else if (!isCollapsed && !expand) {
        onRowCollapse(node, expand);
      }
    }
  };

  handleFieldEdit = () => {
    const { selected } = this.props;
    const { contextMenu } = this.state;

    if (contextMenu.supportFieldEdit && selected.length === 1) {
      const selectedId = selected[0];

      this.closeContextMenu();

      if (this.rowRefs && this.rowRefs[selectedId]) {
        this.rowRefs[selectedId].initPropertyEditor(contextMenu.fieldName);
      }
    }
  };

  setWrapperRef = (ref) => {
    this.wrapper = ref;
  };

  setTableRef = (ref) => {
    this.table = ref;
  };

  setTfootRef = (ref) => {
    this.tfoot = ref;
  };

  renderTableBody = () => {
    const {
      tabId,
      windowId,
      docId,
      readonly,
      keyProperty,
      mainTable,
      newRow,
      tabIndex,
      entity,
      indentSupported,
      collapsible,
      viewId,
      supportOpenRecord,
      focusOnFieldName,
      modalVisible,
      isGerman,
      activeSort,
      page,

      columns,
      rows,
      selected,
      onItemChange,
      onSelectRange,
      onRowCollapse,
      collapsedRows,
      collapsedParentsRows,

      // TODO: Get rid of dataHash
      dataHash,
    } = this.props;

    if (!rows.length || !columns.length) {
      return null;
    }

    this.rowRefs = {};

    let renderRows = rows.filter((row) => {
      if (collapsedRows) {
        return collapsedRows.indexOf(row[keyProperty]) === -1;
      }
      return true;
    });

    if (isMobileOrTablet && rows.length > MOBILE_TABLE_SIZE_LIMIT) {
      renderRows = renderRows.slice(0, MOBILE_TABLE_SIZE_LIMIT);
    }

    return renderRows.map((item, i) => (
      <TableItem
        {...item}
        {...{
          page,
          entity,
          windowId,
          mainTable,
          indentSupported,
          selected,
          docId,
          tabIndex,
          readonly,
          collapsible,
          viewId,
          supportOpenRecord,
          item,
          focusOnFieldName,
          modalVisible,
          isGerman,
          activeSort,
        }}
        cols={columns}
        dataHash={dataHash}
        key={`row-${i}${viewId ? `-${viewId}` : ''}`}
        dataKey={`row-${i}${viewId ? `-${viewId}` : ''}`}
        collapsed={
          collapsedParentsRows &&
          collapsedParentsRows.indexOf(item[keyProperty]) > -1
        }
        odd={i & 1}
        ref={(c) => {
          if (c) {
            const keyProp = item[keyProperty];

            this.rowRefs[keyProp] = c;
          }
        }}
        keyProperty={item[keyProperty]}
        rowId={item[keyProperty]}
        tabId={tabId}
        onDoubleClick={this.handleDoubleClick}
        onClick={this.handleClick}
        handleRightClick={this.handleRightClick}
        changeListenOnTrue={this.setListenTrue}
        changeListenOnFalse={this.setListenFalse}
        newRow={i === rows.length - 1 ? newRow : false}
        isSelected={
          (selected &&
            (selected.indexOf(item[keyProperty]) > -1 ||
              selected[0] === 'all')) ||
          (selected && !selected[0] && focusOnFieldName && i === 0)
        }
        handleSelect={onSelectRange}
        contextType={item.type}
        caption={item.caption ? item.caption : ''}
        colspan={item.colspan}
        notSaved={item.saveStatus && !item.saveStatus.saved}
        getSizeClass={getSizeClass}
        handleRowCollapse={onRowCollapse}
        onItemChange={onItemChange}
        onCopy={handleCopy}
      />
    ));
  };

  renderEmptyInfo = (rows) => {
    const { emptyText, emptyHint, pendingInit } = this.props;

    if (pendingInit) {
      return false;
    }

    if (!rows.length) {
      return (
        <div className="empty-info-text">
          <div>
            <h5>{emptyText}</h5>
            <p>{emptyHint}</p>
          </div>
        </div>
      );
    }

    return false;
  };

  render() {
    RENDERS += 1;
    console.log('Render: ', RENDERS);

    const {
      columns,
      windowId,
      docId,
      tabId,
      viewId,
      readonly,
      size,
      handleChangePage,
      pageLength,
      page,
      mainTable,
      updateDocList,
      sort,
      orderBy,
      toggleFullScreen,
      fullScreen,
      tabIndex,
      indentSupported,
      isModal,
      queryLimitHit,
      supportQuickInput,
      tabInfo,
      allowShortcut,
      disablePaginationShortcuts,
      hasIncluded,
      blurOnIncludedView,
      toggleState,
      spinnerVisible,

      rows,
      selected,
      onHandleZoomInto,
      onSelectRange,
      onSelectAll,
      onDeselectAll,
    } = this.props;

    const {
      contextMenu,
      promptOpen,
      isBatchEntry,

      // TODO: Move to state/container/redux ?
      tableRefreshToggle,
    } = this.state;

    let showPagination = page && pageLength;
    if (currentDevice.type === 'mobile' || currentDevice.type === 'tablet') {
      showPagination = false;
    }

    return (
      <div
        ref={this.setWrapperRef}
        className={classnames('table-flex-wrapper', {
          'col-12': toggleState === 'grid' || toggleState == null,
          'col-6': toggleState === 'all',
          'd-none': toggleState === 'map',
        })}
      >
        <div
          className={classnames({
            'table-flex-wrapper-row': mainTable,
          })}
        >
          {contextMenu.open && (
            <TableContextMenu
              {...contextMenu}
              {...{
                docId,
                windowId,
                mainTable,
                updateDocList,
              }}
              selected={selected}
              blur={this.closeContextMenu}
              tabId={tabId}
              deselect={onDeselectAll}
              handleFieldEdit={this.handleFieldEdit}
              handleAdvancedEdit={this.handleAdvancedEdit}
              onOpenNewTab={handleOpenNewTab}
              handleDelete={
                !isModal && (tabInfo && tabInfo.allowDelete)
                  ? this.handleDelete
                  : null
              }
              handleZoomInto={onHandleZoomInto}
            />
          )}
          {!readonly && (
            <TableFilter
              openTableModal={this.openTableModal}
              {...{
                toggleFullScreen,
                fullScreen,
                docId,
                tabIndex,
                isBatchEntry,
                supportQuickInput,
                selected,
              }}
              docType={windowId}
              tabId={tabId}
              handleBatchEntryToggle={this.handleBatchEntryToggle}
              allowCreateNew={tabInfo && tabInfo.allowCreateNew}
              wrapperHeight={this.wrapper && this.wrapper.offsetHeight}
            />
          )}

          <div
            className={classnames(
              'panel panel-primary panel-bordered',
              'panel-bordered-force table-flex-wrapper',
              'document-list-table js-not-unselect',
              {
                'table-content-empty': !rows.length,
              }
            )}
          >
            <table
              className={classnames(
                'table table-bordered-vertically',
                'table-striped js-table',
                {
                  'table-read-only': readonly,
                  'table-fade-out': hasIncluded && blurOnIncludedView,
                  'layout-fix': tableRefreshToggle,
                }
              )}
              onKeyDown={this.handleKeyDown}
              ref={this.setTableRef}
              onCopy={handleCopy}
            >
              <thead>
                <TableHeader
                  {...{
                    sort,
                    orderBy,
                    page,
                    indentSupported,
                    tabId,
                    docId,
                    viewId,
                  }}
                  cols={columns}
                  windowType={windowId}
                  getSizeClass={getSizeClass}
                  deselect={onDeselectAll}
                />
              </thead>
              <tbody>{this.renderTableBody()}</tbody>
              <tfoot ref={this.setTfootRef} />
            </table>

            {!spinnerVisible && this.renderEmptyInfo(rows)}
          </div>

          {
            // Other 'table-flex-wrapped' components
            // like selection attributes
            this.props.children
          }
        </div>
        {showPagination && (
          <div onClick={this.handleClickOutside}>
            <TablePagination
              {...{
                handleChangePage,
                size,
                page,
                orderBy,
                queryLimitHit,
                disablePaginationShortcuts,
              }}
              onChangePage={handleChangePage}
              selected={selected}
              pageLength={pageLength}
              rowLength={rows.length}
              handleSelectAll={onSelectAll}
              handleSelectRange={onSelectRange}
              TODO={1/* SHOULD THIS BE onDeselect ? */}
              deselect={onDeselectAll}
              onDeselectAll={onDeselectAll}
            />
          </div>
        )}
        {promptOpen && (
          <Prompt
            title="Delete"
            text="Are you sure?"
            buttons={{ submit: 'Delete', cancel: 'Cancel' }}
            onCancelClick={this.handlePromptCancelClick}
            selected={selected}
            onSubmitClick={this.handlePromptSubmitClick}
          />
        )}

        {allowShortcut && (
          <DocumentListContextShortcuts
            windowId={windowId}
            tabId={tabId}
            selected={selected}
            onAdvancedEdit={
              selected && selected.length > 0 && selected[0]
                ? this.handleAdvancedEdit
                : null
            }
            onOpenNewTab={
              selected && selected.length > 0 && selected[0] && mainTable
                ? handleOpenNewTab
                : null
            }
            onDelete={
              selected && selected.length > 0 && selected[0]
                ? this.handleDelete
                : null
            }
            onGetAllLeafs={this.getAllLeafs}
            onIndent={this.handleShortcutIndent}
          />
        )}

        {allowShortcut && !readonly && (
          <TableContextShortcuts
            handleToggleQuickInput={this.handleBatchEntryToggle}
            handleToggleExpand={toggleFullScreen}
          />
        )}
        {isMobileOrTablet && rows.length > MOBILE_TABLE_SIZE_LIMIT && (
          <span className="text-danger">
            {counterpart.translate('view.limitTo', {
              limit: MOBILE_TABLE_SIZE_LIMIT,
              total: rows.length,
            })}
          </span>
        )}
      </div>
    );
  }
}

Table.propTypes = componentPropTypes;

const clickOutsideConfig = {
  excludeScrollbar: true,
};

export default onClickOutside(Table, clickOutsideConfig);
