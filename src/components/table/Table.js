import update from 'immutability-helper';
import * as _ from 'lodash';
import PropTypes from 'prop-types';
import React, { Component } from 'react';
import onClickOutside from 'react-onclickoutside';
import { connect } from 'react-redux';
import { ShortcutManager } from 'react-shortcuts';

import {
    openModal,
    selectTableItems,
    deleteLocal,
    mapIncluded,
    collapsedMap,
    getZoomIntoWindow,
} from '../../actions/WindowActions';
import { deleteRequest } from '../../actions/GenericActions';
import keymap from '../../keymap.js';

import Prompt from '../app/Prompt';
import DocumentListContextShortcuts
    from '../shortcuts/DocumentListContextShortcuts';
import TableContextShortcuts from '../shortcuts/TableContextShortcuts';

import TableFilter from './TableFilter';
import TableItem from './TableItem';
import TablePagination from './TablePagination';
import TableHeader from './TableHeader';
import TableContextMenu from './TableContextMenu';

const shortcutManager = new ShortcutManager(keymap);

class Table extends Component {
    constructor(props) {
        super(props);

        const {defaultSelected} = this.props;

        this.state = {
            selected: defaultSelected || [undefined],
            listenOnKeys: true,
            contextMenu: {
                open: false,
                x: 0,
                y: 0,
                fieldName: null,
                supportZoomInto: false,
                supportFieldEdit: false
            },
            promptOpen: false,
            isBatchEntry: false,
            rows: [],
            collapsedRows: [],
            collapsedParentsRows: [],
            pendingInit: true,
            collapsedArrayMap: []
        }
    }

    componentDidMount(){
        //selecting first table elem while getting indent data
        this.getIndentData(true);

        if (this.props.autofocus) {
            this.table.focus();
        }
    }

    componentDidUpdate(prevProps, prevState) {
        const {
            dispatch, mainTable, open, rowData, defaultSelected,
            disconnectFromState, type, refreshSelection,
            openIncludedViewOnSelect, viewId, isModal, hasIncluded,
        } = this.props;

        const {
            selected, rows
        } = this.state;

        if (
            !_.isEqual(prevState.rows, rows)
        ) {
            if (isModal && !hasIncluded) {
                if (rows) {
                    let firstRow = rows[0];

                    if (firstRow) {
                        if (openIncludedViewOnSelect) {
                            this.showSelectedIncludedView([firstRow.id]);
                        }

                        if (firstRow.id) {
                            this.selectOneProduct(firstRow.id);
                        }
                    }
                }
            }
        }

        if (mainTable && open) {
            this.table.focus();
        }

        if (
            !_.isEqual(prevProps.defaultSelected, defaultSelected) ||
            (prevProps.refreshSelection !== refreshSelection) &&
            refreshSelection
        ) {
            this.setState({
                selected: defaultSelected
            });
        } else if (
            !disconnectFromState &&
            !_.isEqual(prevState.selected, selected)
        ) {
            dispatch(selectTableItems({
                windowType: type,
                viewId,
                ids: selected,
            }));
        }

        if (!_.isEqual(prevProps.rowData, rowData)) {
            this.getIndentData();
        }

        if (prevProps.viewId !== viewId && defaultSelected.length === 0) {
            this.getIndentData(true);
        }
    }

    componentWillUnmount() {
        const {
            showIncludedViewOnSelect, viewId, windowType, isIncluded
        } = this.props;

        this.deselectAllProducts();
        if (showIncludedViewOnSelect && !isIncluded) {
            showIncludedViewOnSelect({
                showIncludedView: false,
                windowType,
                viewId,
            });
        }
    }

    showSelectedIncludedView = (selected) => {
        const { showIncludedViewOnSelect } = this.props;
        const { rows } = this.state;

        if (selected.length === 1) {
            rows.forEach((item) => {
                if (item.id === selected[0]) {
                    showIncludedViewOnSelect({
                        showIncludedView: item.supportIncludedViews,

                        windowType: item.supportIncludedViews ? (
                            item.includedView.windowType ||
                            item.includedView.windowId
                        ) : null,

                        viewId: item.supportIncludedViews ? (
                            item.includedView.viewId
                        ) : '',
                    });
                }
            });
        }
    }

    getChildContext = () => {
        return {
            shortcuts: shortcutManager
        };
    }

    getIndentData = (selectFirst) => {
        const {
            rowData, tabid, indentSupported, collapsible, expandedDepth,
            keyProperty
        } = this.props;

        if(indentSupported && rowData[tabid]){
            let rowsData = [];

            rowData[tabid].map(item => {
                rowsData = rowsData.concat(mapIncluded(item));
            })

            this.setState({
                rows: rowsData,
                pendingInit: !rowsData,
                collapsedParentsRows: [],
                collapsedRows: []
            }, () => {
                const {rows} = this.state;

                const firstRow = rows[0];

                if (selectFirst && firstRow) {
                    this.selectOneProduct(firstRow.id);
                    document.getElementsByClassName('js-table')[0].focus();
                }

                let mapCollapsed = [];
                if(collapsible){

                    rows && !!rows.length && rows.map(row => {
                        if(
                            row.indent.length >= expandedDepth &&
                            row.includedDocuments
                        ){
                            mapCollapsed = mapCollapsed.concat(
                                collapsedMap(row)
                            );
                            this.setState(prev => ({
                                collapsedParentsRows:
                                    prev.collapsedParentsRows.concat(
                                        row[keyProperty]
                                    )
                            }));
                        }
                        if(row.indent.length > expandedDepth){
                            this.setState(prev => ({
                                collapsedRows:
                                    prev.collapsedRows.concat(
                                        row[keyProperty]
                                    )
                            }));
                        }
                    })
                }

                this.setState({
                    collapsedArrayMap: mapCollapsed
                });
            })
        } else {
            this.setState({
                rows: rowData[tabid],
                pendingInit: !rowData[tabid]
            });
        }
    }

    getAllLeafs = () => {
        const {rows, selected} = this.state;
        let leafs = [];
        let leafsIds = [];

        rows.map( item => {
            if(item.id == selected[0]){
                leafs = mapIncluded(item);
            }
        });

        leafs.map(item => {
            leafsIds = leafsIds.concat(item.id);
        });

        this.selectRangeProduct(leafsIds);
    }

    changeListen = (listenOnKeys) => {
        this.setState({
            listenOnKeys: !!listenOnKeys
        })
    }

    selectProduct = (id, idFocused, idFocusedDown) => {
        const {
            dispatch,
            type,
            disconnectFromState,
            tabInfo,
            viewId,
        } = this.props;

        this.setState(prevState => ({
            selected: prevState.selected.concat([id])
        }), () => {
            const {selected} = this.state;

            if (tabInfo) {
                dispatch(selectTableItems({
                    windowType: type,
                    viewId,
                    ids: selected,
                }));
            }

            if (!disconnectFromState) {
                dispatch(selectTableItems({
                    windowType: type,
                    viewId,
                    ids: selected,
                }));
            }

            this.triggerFocus(idFocused, idFocusedDown);
        })
    }

    selectRangeProduct = (ids) => {
        const { dispatch, tabInfo, type, viewId } = this.props;

        this.setState({
            selected: ids
        });

        if (tabInfo) {
            dispatch(selectTableItems({
                windowType: type,
                viewId,
                ids,
            }));
        }
    }

    selectAll = () => {
        const {keyProperty} = this.props;
        const {rows} = this.state;
        const property = keyProperty ? keyProperty : 'rowId';
        const toSelect = rows.map((item) => item[property]);

        this.selectRangeProduct(toSelect);
    }

    selectOneProduct = (id, idFocused, idFocusedDown, cb) => {
        const { dispatch, tabInfo, type, viewId } = this.props;

        this.setState({
            selected: [id]
        }, () => {
            if (tabInfo) {
                dispatch(selectTableItems({
                    windowType: type,
                    viewId,
                    ids: [id],
                }));
            }

            this.triggerFocus(idFocused, idFocusedDown);
            cb && cb();
        })
    }

    deselectProduct = (id) => {
        const { dispatch, tabInfo, type, viewId } = this.props;
        const index = this.state.selected.indexOf(id);

        this.setState(update(this.state, {
            selected: {$splice: [[index, 1]]}
        }), () => {
            if (tabInfo) {
                dispatch(selectTableItems({
                    windowType: type,
                    viewId,
                    ids: this.state.selected,
                }));
            }
        })
    }

    deselectAllProducts = (cb) => {
        const { dispatch, tabInfo, type, viewId } = this.props;

        this.setState({
            selected: []
        }, cb && cb());

        if (tabInfo) {
            dispatch(selectTableItems({
                windowType: type,
                viewId,
                ids: [],
            }));
        }
    }

    triggerFocus = (idFocused, idFocusedDown) => {
        if (this.table) {
            const rowSelected = this.table.getElementsByClassName(
                'row-selected'
            );

            if(rowSelected.length > 0){
                if(typeof idFocused == 'number'){
                    rowSelected[0].children[idFocused].focus();
                }
                if(typeof idFocusedDown == 'number'){
                    rowSelected[rowSelected.length-1]
                        .children[idFocusedDown].focus();
                }
            }
        }
    }

    handleClickOutside = (event) => {
        const {
            showIncludedViewOnSelect, viewId, windowType, inBackground,
        } = this.props;

        if (event.target.parentNode !== document && event.target.parentNode &&
            !event.target.parentNode.className.includes('notification') &&
            !inBackground
        ) {
            const item = event.path;

            if (item) {
                for (let i = 0; i < item.length; i++) {
                    if (item[i].classList &&
                        item[i].classList.contains('js-not-unselect')
                    ) {
                        return;
                    }
                }
            }

            this.deselectAllProducts();
            if (showIncludedViewOnSelect) {
                showIncludedViewOnSelect({
                    showIncludedView: false,
                    windowType,
                    viewId,
                });
            }
        }
    }

    handleKeyDown = (e) => {
        const {selected, rows, listenOnKeys, collapsedArrayMap} = this.state;

        if(!listenOnKeys){
            return;
        }

        const selectRange = e.shiftKey;
        const {keyProperty, mainTable, readonly} = this.props;

        const {
            onDoubleClick, closeOverlays
        } = this.props;

        const nodeList =
            Array.prototype.slice.call(
                document.activeElement.parentElement.children
            );
        const idActive = nodeList.indexOf(document.activeElement);

        let idFocused = null;
        if(idActive > -1) {
            idFocused = idActive;
        }

        switch(e.key) {
            case 'ArrowDown': {
                e.preventDefault();

                const array = collapsedArrayMap.length > 0 ?
                    collapsedArrayMap.map((item) => item[keyProperty]) :
                    rows.map((item) => item[keyProperty]);
                const currentId = array.findIndex(x =>
                    x === selected[selected.length-1]
                );

                if(currentId >= array.length - 1){
                    return;
                }

                if(!selectRange) {
                    this.selectOneProduct(
                        array[currentId + 1], false, idFocused,
                        this.showSelectedIncludedView([array[currentId + 1]])
                    );
                } else {
                    this.selectProduct(
                        array[currentId + 1], false, idFocused
                    );
                }
                break;
            }
            case 'ArrowUp': {
                e.preventDefault();

                const array = collapsedArrayMap.length > 0 ?
                    collapsedArrayMap.map((item) => item[keyProperty]) :
                    rows.map((item) => item[keyProperty]);
                const currentId = array.findIndex(x =>
                    x === selected[selected.length-1]
                );

                if(currentId <= 0 ){
                    return;
                }

                if(!selectRange) {
                    this.selectOneProduct(
                        array[currentId - 1], idFocused, false,
                        this.showSelectedIncludedView([array[currentId - 1]])
                    );

                } else {
                    this.selectProduct(
                        array[currentId - 1], idFocused, false
                    );
                }
                break;
            }
            case 'ArrowLeft':
                e.preventDefault();
                if(document.activeElement.previousSibling){
                    document.activeElement.previousSibling.focus();
                }
                break;
            case 'ArrowRight':
                e.preventDefault();
                if(document.activeElement.nextSibling){
                    document.activeElement.nextSibling.focus();
                }
                break;
            case 'Tab':
                if(mainTable){
                    e.preventDefault();
                    const focusedElem =
                        document.getElementsByClassName('js-attributes')[0];
                    if(focusedElem){
                        focusedElem.getElementsByTagName('input')[0].focus();
                    }
                    break;
                }else{
                    if(e.shiftKey){
                        //passing focus over table cells backwards
                        this.table.focus();
                    }else{
                        //passing focus over table cells
                        this.tfoot.focus();
                    }
                }
                break;
            case 'Enter':
                if(selected.length <= 1 && onDoubleClick && readonly) {
                    e.preventDefault();
                    onDoubleClick(selected[selected.length-1]);
                }
                break;
            case 'Escape':
                closeOverlays && closeOverlays();
                break;
        }
    }

    closeContextMenu = () => {
        this.setState({
            contextMenu: Object.assign({}, this.state.contextMenu, {
                open: false
            })
        })
    }

    handleClick = (e, id) => {
        if(e.button === 0){
            const {selected} = this.state;
            const selectMore = e.nativeEvent.metaKey || e.nativeEvent.ctrlKey;
            const selectRange = e.shiftKey;
            const isSelected = selected.indexOf(id) > -1;
            const isAnySelected = selected.length > 0;

            if(selectMore){
                if(isSelected){
                    this.deselectProduct(id);
                }else{
                    this.selectProduct(id);
                }
            }else if(selectRange){
                if(isAnySelected){
                    const idsToSelect = this.getProductRange(id);
                    this.selectRangeProduct(idsToSelect);
                }else{
                    this.selectOneProduct(id);
                }
            }else{
                this.selectOneProduct(id);
            }
        }
    }

    handleRightClick = (e, id, fieldName,
                        supportZoomInto, supportFieldEdit) => {
        const {selected} = this.state;
        const {clientX, clientY} = e;
        e.preventDefault();

        if(selected.indexOf(id) > -1){
            this.setContextMenu(clientX, clientY, fieldName,
                supportZoomInto, supportFieldEdit);
        }else{
            this.selectOneProduct(id, null, null, () => {
                this.setContextMenu(clientX, clientY, fieldName,
                    supportZoomInto, supportFieldEdit);
            });
        }
    }

    setContextMenu = (clientX, clientY, fieldName,
                      supportZoomInto, supportFieldEdit) => {
        this.setState({
            contextMenu: Object.assign({}, this.state.contextMenu, {
                x: clientX,
                y: clientY,
                open: true,
                fieldName,
                supportZoomInto,
                supportFieldEdit
            })
        });
    }

    getProductRange = (id) => {
        const { keyProperty } = this.props;
        const { rows } = this.state;
        let arrayIndex;

        let selectIdA;
        let selectIdB;

        arrayIndex = rows.map(item => item[keyProperty]);
        selectIdA = arrayIndex.findIndex(x => x === id);
        selectIdB = arrayIndex.findIndex(x => x === this.state.selected[0]);

        let selected = [
            selectIdA,
            selectIdB
        ];

        selected.sort((a, b) => a - b);
        return arrayIndex.slice(selected[0], selected[1]+1);
    }

    handleBatchEntryToggle = () => {
        const {isBatchEntry} = this.state;

        this.setState({
            isBatchEntry: !isBatchEntry
        });
    }

    openModal = (windowType, tabId, rowId) => {
        const {dispatch} = this.props;
        dispatch(openModal('Add new', windowType, 'window', tabId, rowId));
    }

    handleAdvancedEdit = (type, tabId, selected) => {
        const {dispatch} = this.props;

        dispatch(openModal(
            'Advanced edit', type, 'window', tabId, selected[0], true
        ));
    }

    handleOpenNewTab = (selected) => {
        const {type} = this.props;
        for(let i = 0; i < selected.length; i++){
            window.open('/window/' + type + '/' + selected[i], '_blank');
        }
    }

    handleDelete = () => {
        this.setState({
            promptOpen: true
        })
    }

    handlePromptCancelClick = () => {
        this.setState({
            promptOpen: false
        })
    }

    handlePromptSubmitClick = (selected) => {
        const {
            dispatch, type, docId, updateDocList, tabid
        } = this.props;

        this.setState({
            promptOpen: false,
            selected: []
        }, () => {
            deleteRequest(
                'window', type, docId ? docId : null, docId ? tabid : null,
                selected
            ).then(response => {
                if(docId){
                    dispatch(deleteLocal(tabid, selected, 'master', response))
                } else {
                    updateDocList();
                }
            });
        });
    }

    getSelectedRows = () => {
        const {rows, selected} = this.state;
        const {keyProperty} = this.props;
        const keyProp = keyProperty ? keyProperty : 'rowId';

        let selectedRows = [];
        Object.keys(rows).map(id => {
            if(selected.indexOf(rows[id][keyProp]) > -1){
                selectedRows.push(rows[id].fieldsByName);
            }
        });

        return selectedRows;
    }

    handleCopy = (e) => {
        const {cols} = this.props;
        e.preventDefault();

        // Prepare table headers
        const header = cols
            .map(col => col.caption)
            .join();

        // Prepare selected rows
        const selectedRows = this.getSelectedRows();

        // Prepare values of selectedRows to display
        const content = selectedRows.map(row =>
            cols.map(col => {
                const field = row[col.fields[0].field];
                //getItemsByProperty(row, 'field', col.fields[0].field)[0];
                const value = field ? field.value : '';

                if(typeof value === 'object' && value !== null){
                    return value[Object.keys(value)[0]];
                }else{
                    return value;
                }
            })
        )

        // Push together to clipboard
        const toCopy = header + '\n' + content.join('\n');
        e.clipboardData.setData('text/plain', toCopy);
    }

    handleZoomInto = (fieldName) => {
        const {entity, type, docId, tabid, viewId} = this.props;
        const {selected} = this.state;

        getZoomIntoWindow(
            entity, type, docId, (entity === 'window' ? tabid : viewId),
            selected[0], fieldName
        ).then(res => {
            res && res.data && window.open('/window/' +
                   res.data.documentPath.windowId + '/' +
                   res.data.documentPath.documentId, '_blank');
        })
    }

    getSizeClass = (col) => {
        const {widgetType, size} = col;
        const lg = ['List', 'Lookup', 'LongText', 'Date', 'DateTime', 'Time'];
        const md = ['Text', 'Address', 'ProductAttributes'];

        if(size){
            switch(size){
                case 'S':
                    return 'td-sm';
                case 'M':
                    return 'td-md';
                case 'L':
                    return 'td-lg';
            }
        }else{
            if(lg.indexOf(widgetType) > -1){
                return 'td-lg';
            }else if(md.indexOf(widgetType) > -1){
                return 'td-md';
            }else {
                return 'td-sm';
            }
        }
    }

    handleRowCollapse = (node, collapsed) => {
        const {keyProperty} = this.props;
        const {
            collapsedParentsRows, collapsedRows, collapsedArrayMap
        } = this.state;

        this.setState({
            collapsedArrayMap: collapsedMap(node, collapsed, collapsedArrayMap)
        });

        if(collapsed){
            this.setState(prev => ({
                collapsedParentsRows:
                    update(prev.collapsedParentsRows,
                        {$splice: [[
                            prev.collapsedParentsRows
                                .indexOf(node[keyProperty]), 1
                            ]]
                        })
            }));
        }else{
            if(collapsedParentsRows.indexOf(node[keyProperty]) > -1) return;
            this.setState(prev => ({
                collapsedParentsRows:
                    prev.collapsedParentsRows.concat(node[keyProperty])
            }));
        }

        node.includedDocuments && node.includedDocuments.map(node => {
            if(collapsed){
                this.setState(prev => ({
                    collapsedRows: update(prev.collapsedRows, {
                        $splice: [[
                            prev.collapsedRows.indexOf(node[keyProperty]), 1
                        ]]
                    })
                }));
            }else{
                if(collapsedRows.indexOf(node[keyProperty]) > -1) return;
                this.setState(prev => ({
                    collapsedRows: prev.collapsedRows.concat(node[keyProperty])
                }));
                node.includedDocuments &&
                    this.handleRowCollapse(node, collapsed);
            }
        })
    }

    handleShortcutIndent = (expand) => {
        const {selected, rows, collapsedParentsRows} = this.state;
        const {keyProperty} = this.props;

        let node = '';
        let isCollapsed = '';
        selected.length === 1 && rows.map((item)=>{
            if(item.id === selected[0]){
                if(item.includedDocuments){
                    const keyProp = item[keyProperty];
                    node = item;
                    isCollapsed = collapsedParentsRows.indexOf(keyProp) > -1;
                }
            }
        });

        if(node){
            if(isCollapsed && expand) {
                this.handleRowCollapse(node, expand);
            } else if(!isCollapsed && !expand) {
                this.handleRowCollapse(node, expand);
            }
        }
    }

    handleFieldEdit = (selected, fieldName) => {
        this.closeContextMenu();

        const selectedId = selected[0];

        if (this.rowRefs && this.rowRefs[selectedId]) {
            this.rowRefs[selectedId].initPropertyEditor(fieldName);
        }
    }

    handleItemChange = (rowId, prop, value) => {
        const { mainTable, keyProperty } = this.props;

        if (mainTable) {
            const { rows } = this.state;

            if (!rows || !rows.length) return;

            rows.filter( (row) => row[keyProperty] === rowId )
                .map( (item) => {
                    let field = item.fieldsByName[prop];

                    if (field) {
                        field.value = value;
                    }
                });
        }
    }

    renderTableBody = () => {
        const {
            tabid, cols, type, docId, readonly, keyProperty, onDoubleClick,
            mainTable, newRow, tabIndex, entity, indentSupported, collapsible,
            showIncludedViewOnSelect, openIncludedViewOnSelect
        } = this.props;

        const {
            selected, rows, collapsedRows, collapsedParentsRows
        } = this.state;

        if (!rows || !rows.length) return;

        this.rowRefs = {};

        return rows
            .filter(row => collapsedRows.indexOf(row[keyProperty]) === -1)
            .map((item, i) => (
                <tbody key={i}>
                    <TableItem
                        {...item}
                        {...{entity, cols, type, mainTable, indentSupported,
                            selected, docId, tabIndex, readonly, collapsible
                        }}
                        collapsed={
                            collapsedParentsRows
                                .indexOf(item[keyProperty]) > -1
                        }
                        odd={i & 1}
                        ref={(c) => {
                            if (c) {
                                const keyProp = item[keyProperty];
                                this.rowRefs[keyProp] = c.refs.wrappedInstance;
                            }
                        }}
                        rowId={item[keyProperty]}
                        tabId={tabid}
                        onDoubleClick={() => onDoubleClick &&
                            onDoubleClick(item[keyProperty])
                        }
                        onMouseDown={(e) => {
                            this.handleClick(e, item[keyProperty]);
                            if (openIncludedViewOnSelect) {
                                showIncludedViewOnSelect({
                                    showIncludedView: item.supportIncludedViews,

                                    windowType: item.supportIncludedViews ? (
                                        item.includedView.windowType ||
                                        item.includedView.windowId
                                    ) : null,

                                    viewId: item.supportIncludedViews ? (
                                        item.includedView.viewId
                                    ) : '',
                                });
                            }
                        }}
                        handleRightClick={(e, fieldName, supportZoomInto,
                                           supportFieldEdit) =>
                            this.handleRightClick(
                                e, item[keyProperty], fieldName,
                                !!supportZoomInto, supportFieldEdit
                            )
                        }
                        changeListenOnTrue={() => this.changeListen(true)}
                        changeListenOnFalse={() => this.changeListen(false)}
                        newRow={i === rows.length - 1 ? newRow : false}
                        isSelected={
                            selected.indexOf(item[keyProperty]) > -1 ||
                            selected[0] === 'all'
                        }
                        handleSelect={this.selectRangeProduct}
                        contextType={item.type}
                        caption={item.caption ? item.caption:''}
                        colspan={item.colspan}
                        notSaved={
                            item.saveStatus &&
                            !item.saveStatus.saved
                        }
                        getSizeClass={this.getSizeClass}
                        handleRowCollapse={() =>
                            this.handleRowCollapse(item,
                            collapsedParentsRows
                                .indexOf(item[keyProperty]) > -1)
                        }
                        onItemChange={this.handleItemChange}
                    />
                </tbody>
        ));
    }

    renderEmptyInfo = (data, tabId) => {
        const {emptyText, emptyHint} = this.props;
        const {pendingInit} = this.state;

        if(pendingInit){
            return false;
        }

        if(
            (data && data[tabId] && Object.keys(data[tabId]).length === 0) ||
            (!data[tabId])
        ){
            return (
                <div className="empty-info-text">
                    <div>
                        <h5>{emptyText}</h5>
                        <p>{emptyHint}</p>
                    </div>
                </div>
            )
        }else{
            return false;
        }
    }

    render() {
        const {
            cols, type, docId, rowData, tabid, readonly, size, handleChangePage,
            pageLength, page, mainTable, updateDocList, sort, orderBy,
            toggleFullScreen, fullScreen, tabIndex, indentSupported, isModal,
            queryLimitHit, supportQuickInput, tabInfo,
            disablePaginationShortcuts, hasIncluded
        } = this.props;

        const {
            contextMenu, selected, promptOpen, isBatchEntry, rows
        } = this.state;

        return (
            <div className="table-flex-wrapper">
                <div className={'table-flex-wrapper ' +
                        (mainTable ? 'table-flex-wrapper-row ' : '')
                    }
                >
                    {contextMenu.open && <TableContextMenu
                        {...contextMenu}
                        {...{docId, type, selected, mainTable, updateDocList}}
                        blur={() => this.closeContextMenu()}
                        tabId={tabid}
                        deselect={() => this.deselectAllProducts()}
                        handleFieldEdit={() => {
                            if (
                                contextMenu.supportFieldEdit &&
                                (selected.length === 1)
                            ) {
                                this.handleFieldEdit(
                                    selected, contextMenu.fieldName
                                );
                            }
                        }}
                        handleAdvancedEdit={() =>
                            this.handleAdvancedEdit(type, tabid, selected)
                        }
                        handleOpenNewTab={() => this.handleOpenNewTab(selected)}
                        handleDelete={(
                            !isModal && (tabInfo && tabInfo.allowDelete)) ?
                                () => this.handleDelete() : null}
                        handleZoomInto={this.handleZoomInto}
                    />}
                    {!readonly && <div className="row">
                        <div className="col-xs-12">
                            <TableFilter
                                openModal={() =>
                                    this.openModal(type, tabid, 'NEW')
                                }
                                {...{toggleFullScreen, fullScreen, docId,
                                    tabIndex, isBatchEntry, supportQuickInput}}
                                docType={type}
                                tabId={tabid}
                                handleBatchEntryToggle={
                                    this.handleBatchEntryToggle
                                }
                                allowCreateNew={
                                    tabInfo && tabInfo.allowCreateNew
                                }
                            />
                        </div>
                    </div>}

                    <div
                        className={
                            'panel panel-primary panel-bordered ' +
                            'panel-bordered-force table-flex-wrapper ' +
                            'document-list-table js-not-unselect ' +
                            ((
                                (rowData && rowData[tabid] &&
                                Object.keys(rowData[tabid]).length === 0) ||
                                (!rowData[tabid])
                            ) ? 'table-content-empty ' : '')
                        }
                    >
                        <table
                            className={
                                'table table-bordered-vertically ' +
                                'table-striped js-table ' +
                                (readonly ? 'table-read-only ' : '') +
                                (hasIncluded ? 'table-fade-out': '')
                            }
                            onKeyDown={this.handleKeyDown}
                            tabIndex={tabIndex}
                            ref={c => this.table = c}
                            onCopy={this.handleCopy}
                        >
                            <thead>
                                <TableHeader
                                    {...{cols, sort, orderBy, page,
                                        indentSupported, tabid
                                    }}
                                    getSizeClass={this.getSizeClass}
                                    deselect={this.deselectAllProducts}
                                />
                            </thead>
                            {this.renderTableBody()}
                            <tfoot
                                ref={c => this.tfoot = c}
                                tabIndex={tabIndex}
                            />
                        </table>

                        {this.renderEmptyInfo(rowData, tabid)}
                    </div>

                    {
                        // Other 'table-flex-wrapped' components
                        // like selection attributes
                        this.props.children
                    }
                </div>
                {page && pageLength &&
                    <div>
                        <TablePagination
                            {...{handleChangePage, size,
                                selected, page, orderBy, queryLimitHit,
                                disablePaginationShortcuts}}
                            pageLength={pageLength}
                            rowLength={rows ? rows.length : 0}
                            handleSelectAll={this.selectAll}
                            handleSelectRange={this.selectRangeProduct}
                            deselect={this.deselectAllProducts}
                        />
                    </div>
                }
                {promptOpen &&
                    <Prompt
                        title="Delete"
                        text="Are you sure?"
                        buttons={{submit: 'Delete', cancel: 'Cancel'}}
                        onCancelClick={this.handlePromptCancelClick}
                        onSubmitClick={() =>
                            this.handlePromptSubmitClick(selected)
                        }
                    />
                }

                <DocumentListContextShortcuts
                    handleAdvancedEdit={selected.length > 0 ?
                        () => this.handleAdvancedEdit(type, tabid, selected) :
                        ''
                    }
                    handleOpenNewTab={selected.length > 0 && mainTable ?
                        () => this.handleOpenNewTab(selected) : ''
                    }
                    handleDelete={selected.length > 0 ?
                        () => this.handleDelete() : ''
                    }
                    getAllLeafs={this.getAllLeafs}

                    handleIndent = {this.handleShortcutIndent}
                />

                {!readonly &&
                    <TableContextShortcuts
                        handleToggleQuickInput={this.handleBatchEntryToggle}
                        handleToggleExpand={() => toggleFullScreen(!fullScreen)}
                    />
                }
            </div>
        )
    }
}

Table.childContextTypes = {
    shortcuts: PropTypes.object.isRequired
}

Table.propTypes = {
    dispatch: PropTypes.func.isRequired
}

Table = connect(false, false, false, { withRef: true })(onClickOutside(Table))

export default Table
