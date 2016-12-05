import React, { Component, PropTypes } from 'react';
import { connect } from 'react-redux';

import RawList from './RawList';

import {
    dropdownRequest,
    filterDropdownRequest
} from '../../actions/AppActions';

class List extends Component {
    constructor(props) {
        super(props);
        this.state = {
            list: [],
            loading: false
        }
    }

    handleFocus = () => {
        const {
            properties, dispatch, dataId, rowId, tabId, windowType, filterWidget,
            filterId, parameterName, entity
        } = this.props;

        this.setState(Object.assign({}, this.state, {
            loading: true
        }));

        if (filterWidget) {
            dispatch(filterDropdownRequest(windowType, filterId, parameterName)).then((res) => {
                this.setState(Object.assign({}, this.state, {
                    list: res.data.values,
                    loading: false
                }));
            });
        } else {
            dispatch(dropdownRequest(windowType, properties[0].field, dataId, tabId, rowId, entity)).then((res) => {
                this.setState(Object.assign({}, this.state, {
                    list: res.data.values,
                    loading: false
                }));
            });
        }
    }

    handleSelect = (option) => {
        const {onChange, setSelectedItem, filterWidget} = this.props;
        onChange(option);
        if(filterWidget){
            setSelectedItem(option);
        }
    }

    render() {
        const {rank, readonly, defaultValue, selected, align, updated, rowId} = this.props;
        const {list, loading} = this.state;

        return (
            <RawList
                list={list}
                loading={loading}
                onFocus={this.handleFocus}
                onSelect={option => this.handleSelect(option)}
                rank={rank}
                readonly={readonly}
                defaultValue={defaultValue}
                selected={selected}
                align={align}
                updated={updated}
                rowId={rowId}
            />
        )
    }
}

List.propTypes = {
    dispatch: PropTypes.func.isRequired
};

List = connect()(List)

export default List
