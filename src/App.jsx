import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from 'react-query';
import './App.css';
import Navbar from './Navbar';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import 'ag-grid-enterprise';
import axios from 'axios';

const NewRowModal = ({ isOpen, onSave, onClose, editRow }) => {
  // Initialize the state with the fields relevant to your issues
  const [newRow, setNewRow] = useState({ reference: '', title: '' });

  useEffect(() => {
    if (isOpen) {
      setNewRow(editRow ? { ...editRow } : { reference: '', title: '' });
    }
  }, [editRow, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Update the newRow state based on input changes
    setNewRow(prevRow => ({ ...prevRow, [name]: value }));
  };

  const handleSubmit = () => {
    onSave({ ...newRow, id: editRow?.id }); // Pass the id back if editing
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div style={{ position: 'fixed', top: '20%', left: '50%', transform: 'translate(-50%, -50%)', backgroundColor: 'white', padding: '20px', zIndex: 1000 }}>
      <div>
        <label>Reference:</label>
        <input type="text" name="reference" value={newRow.reference} onChange={handleChange} />
      </div>
      <div>
        <label>Title:</label>
        <input type="text" name="title" value={newRow.title} onChange={handleChange} />
      </div>
      <button onClick={handleSubmit}>Save</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};


const App = () => {
  const gridRef = useRef(null);
  // const [rowData, setRowData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const processFilters = (filters) => {
    //Log the previous filters before processing
    console.log('These are my filters before processing.')
    console.log(filters);
    const processedFilters = [];
  
    // if (filters['issue_responsiblecontactpersontext']) {
    //   const filterValue = filters['issue_responsiblecontactpersontext'].filter;
    //   // Assuming you want to check this value against two fields: firstname and surname
    //   processedFilters.push({
    //     field: 'issue_responsiblecontactperson_firstname',
    //     operator: 'TEXT_IS_LIKE',
    //     value: filterValue
    //   });
    //   processedFilters.push({
    //     field: 'issue_responsiblecontactperson_surname',
    //     operator: 'TEXT_IS_LIKE',
    //     value: filterValue
    //   });
    // }

    if (filters['issue_responsiblecontactpersontext']) {
      const filterValue = filters['issue_responsiblecontactpersontext'].filter;
      // Assuming you want to check this value against two fields: firstname and surname
      processedFilters.push({
        "field": "issue_responsiblecontactpersontext",
              "comparison": "TEXT_IS_LIKE",
              "value": filterValue
            });
    }
  
    // Add additional complex filter logic as needed
    console.log('here are my processed filters');
    console.log(processedFilters);
  
    return processedFilters;
  };

  const fetchGridData = async ({ queryKey }) => {
    const [_key, { filters, sortModel }] = queryKey;
    const url = '/rpc/issue/?method=ISSUE_SEARCH';
    let criteria = {
      "fields": [
        // {"name": "issue_reference"},
        // {"name": "issue_raiseddate"},
        {"name": "issue_responsiblecontactpersontext"},
        // {"name": "issue_causecontactpersontext"},
        // {"name": "issue_responsiblecontactperson_streetstate"},
        // {"name": "issue_responsiblecontactperson_contactbusiness_tradename"},
        // {"name": "issue_responsiblecontactbusinesstext"},
        // {"name": "issue_title"},
        // {"name": "issue_seissueidentification"},
        // {"name": "issue_seimpact"},
        // {"name": "issue_statustext"},
        // {"name": "issue_seclientobject1_firstname"},
      ],
      "summaryFields":
      [
        {
          "name": "count(*) issuecount"
        }
      ],
      "filters": processFilters(filters),
      "sorts":
      [ 
        // { 
        //   "name": "issue_modifieddate",
        //   "direction": "desc"
        // }
      ],
      "options":
      {
        "rf": "json",
        "startrow": "0",
        "rows": 10	
      }
        }

    // if (filters['responsiblecontactpersontext']) {
    //   const adviserFilter = filters['responsiblecontactpersontext'];
    //   if (adviserFilter.filter) {  // Make sure the filter value exists
    //     criteria.filter.push({
    //       "field": "issue_responsiblecontactpersontext",
    //       "operator": "TEXT_IS_LIKE",
    //       "value": adviserFilter.filter
    //     });
    //   }
    // }

    // Loop through all filters from AG-Grid and add them to the criteria
    // Object.entries(filters).forEach(([key, filter]) => {
    //   if (filter.filterType === 'text' && filter.type === 'contains' && filter.filter) {
    //     criteria.filter.push({
    //       "field": key,
    //       "operator": "TEXT_IS_LIKE",  // Assuming TEXT_IS_LIKE is the backend supported operator for contains
    //       "value": filter.filter
    //     });
    //   }
    // });

    console.log('Updated criteria with filters:', criteria);
    
        const params = new URLSearchParams({ criteria: JSON.stringify(criteria) });
    const response = await axios.post(url, params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    });

    return response.data.data.rows; // Modify based on your API's response
  };

  const { data: rowData, refetch } = useQuery(['gridData', { filters: {}, sortModel: [] }], fetchGridData, {
    refetchOnWindowFocus: false, // Prevents refetching when the window gains focus
    refetchOnMount: false, 
    keepPreviousData: true, // Enable this to keep old data while loading new data
  });
    
  const onFilterChanged = useCallback((event) => {
    const allFilters = event.api.getFilterModel();
    console.log('Current Filters:', allFilters);

    // Assuming refetch is properly set up to handle this structure:
    refetch(['gridData', { filters: allFilters, sortModel: [] }]);
  }, [refetch]);

  // const onSortChanged = useCallback(() => {
  //   if (gridRef.current) {
  //     const allColumnsState = gridRef.current.api.getColumnState();
  //     const sortedColumn = allColumnsState.find(s => s.sort != null);
  //     if (sortedColumn) {
  //       setSortModel([sortedColumn]);
  //     } else {
  //       setSortModel([]);
  //     }
  //   }
  // }, []);

  const handleSearchChange = (searchValue) => {
    gridRef.current.api.setQuickFilter(searchValue);
  };

  const handleAddNewClick = () => {
    setSelectedRowData(null); // Explicitly clear any selection
    setIsModalOpen(true);
  };

  const handleSaveNewRow = (newOrUpdatedRow) => {
      // Check if we're editing an existing row (indicated by the presence of an 'id')
      if (newOrUpdatedRow.id) {
        // Editing existing row
        // Make sure the object structure here matches what's expected by your grid and backend
        const updatedRows = rowData.map(row => 
          row.id === newOrUpdatedRow.id 
          ? { ...row, reference: newOrUpdatedRow.reference, title: newOrUpdatedRow.title } 
          : row
        );
        setRowData(updatedRows);
      } else {
        // Adding a new row
        // Generate a new unique ID for the new issue
        const newId = rowData.length > 0 ? Math.max(...rowData.map(r => r.id)) + 1 : 1;
        // Ensure the new object structure matches your data model
        setRowData([...rowData, { ...newOrUpdatedRow, id: newId, reference: newOrUpdatedRow.reference, title: newOrUpdatedRow.title }]);
      }
      // Close the modal and reset any selections
      setIsModalOpen(false);
      setSelectedRowData(null);
  };

  const handleEditClick = (rowData) => {
    setSelectedRowData(rowData); // This should include the `id`
    setIsModalOpen(true);
  };

  const handleDeleteClick = (rowData) => {
    setRowData(currentRows => currentRows.filter(row => row !== rowData));
  };

  //Added the onRowClicked code below for returning row ID
  // const onRowClicked = (event) => {
  //   // Assuming each row data has an 'id' field
  //   alert(event.data.id);
  // };
  const onExportClick = () => {
    gridRef.current.api.exportDataAsExcel();
  };

  const ActionsCellRenderer = (props) => {
      return (
        <div>
          <button onClick={() => handleEditClick(props.data)} style={{
            marginRight: 5, 
            border: 'none', 
            background: 'none', 
            cursor: 'pointer',
            color: '#272D3B' // Sets the color for both icons
          }}>
            <i className="fas fa-edit"></i> {/* Font Awesome Edit Icon */}
          </button>
          <button onClick={() => handleDeleteClick(props.data)} style={{
            border: 'none', 
            background: 'none', 
            cursor: 'pointer',
            color: '#272D3B' // Ensures consistent color styling
          }}>
            <i className="fas fa-trash"></i> {/* Font Awesome Trash Icon */}
          </button>
        </div>
      );
  };

  const [selectedRowData, setSelectedRowData] = useState(null);

  const [columnDefs] = useState([
    { field: 'issue_reference', headerName: 'Reference', flex: 1, minWidth: 100, filter: 'agTextColumnFilter' },
    { field: 'raiseddate', headerName: 'Date', flex: 1, minWidth: 100, filter: 'agDateColumnFilter' },
    { field: 'issue_responsiblecontactpersontext', headerName: 'Adviser', flex: 1, minWidth: 100, filter: 'agTextColumnFilter', filterParams: { newRowsAction: 'keep' } },
    { field: 'causecontactpersontext', headerName: 'Responsible Person', flex: 1, minWidth: 100, filter: 'agTextColumnFilter' },
    { field: 'responsiblecontactperson_streetstate', headerName: 'State', flex: 1, minWidth: 100, filter: 'agTextColumnFilter' },
    { field: 'responsiblecontactperson_contactbusiness_tradename', headerName: 'Licensee', flex: 1, minWidth: 100, filter: 'agTextColumnFilter' },
    { field: 'responsiblecontactbusinesstext', headerName: 'Business', flex: 1, minWidth: 100, filter: 'agTextColumnFilter' },
    { field: 'seissueidentification', headerName: 'Source', flex: 1, minWidth: 100, filter: 'agTextColumnFilter' },
    { field: 'seimpact', headerName: 'Impact', flex: 1, minWidth: 100, filter: 'agTextColumnFilter' },
    { field: 'title', headerName: 'Title', flex: 1, minWidth: 100, filter: 'agTextColumnFilter' },
    { field: 'statustext', headerName: 'Status', flex: 1, minWidth: 100, filter: 'agSetColumnFilter', filterParams: {
      suppressSelectAll: true,
      comparator: (a, b) => a.localeCompare(b), // Example of custom sorting
      values: ['Not Started', 'In Progress', 'Completed', 'Archived'] 
    } },
    { field: 'seclientobject1_firstname', headerName: 'Manager', flex: 1, minWidth: 100, filter: 'agTextColumnFilter' },
    {
      headerName: 'Actions',
      cellRenderer: ActionsCellRenderer,
      editable: false,
      filter: false,
      sortable: false,
      minWidth: 180
    }
  ]);

  return (
    <div className="page-container">
      <Navbar onSearchChange={handleSearchChange} />
      <div className="grid-toolbar">
        <button className='btn' onClick={handleAddNewClick}>Add New</button>
        <button className='btn' onClick={onExportClick}>Export to Excel</button>
      </div>
      <NewRowModal isOpen={isModalOpen} onSave={handleSaveNewRow} onClose={() => setIsModalOpen(false)} editRow={selectedRowData} />
      <div className="ag-theme-alpine" style={{ height: 500, width: '100%' }}>
        <AgGridReact
          ref={gridRef}
          columnDefs={columnDefs}
          rowData={rowData}
          domLayout='autoHeight'
          rowSelection="single"
          pagination={true}
          paginationPageSize={20}
          onFilterChanged={onFilterChanged}
          // onSortChanged={onSortChanged}
          // Disable AG-Grid built-in filtering and sorting since server-side is used
          enableServerSideSorting={true}
          enableServerSideFilter={true}
          //Added the line below for returning row ID
          // onRowClicked={onRowClicked}
        ></AgGridReact>
      </div>
    </div>
  );
};

export default App;