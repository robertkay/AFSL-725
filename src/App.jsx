import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "react-query";
import "./App.css";
import Navbar from "./Navbar";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import "ag-grid-enterprise";
import axios from "axios";
import { debounce } from "lodash";

const NewRowModal = ({ isOpen, onSave, onClose, editRow }) => {
  // Initialize the state with the fields relevant to your issues
  const [newRow, setNewRow] = useState({ reference: "", title: "" });

  useEffect(() => {
    if (isOpen) {
      setNewRow(editRow ? { ...editRow } : { reference: "", title: "" });
    }
  }, [editRow, isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    // Update the newRow state based on input changes
    setNewRow((prevRow) => ({ ...prevRow, [name]: value }));
  };

  const handleSubmit = () => {
    onSave({ ...newRow, id: editRow?.id }); // Pass the id back if editing
    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        top: "20%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        backgroundColor: "white",
        padding: "20px",
        zIndex: 1000,
      }}
    >
      <div>
        <label>Reference:</label>
        <input
          type="text"
          name="reference"
          value={newRow.reference}
          onChange={handleChange}
        />
      </div>
      <div>
        <label>Title:</label>
        <input
          type="text"
          name="title"
          value={newRow.title}
          onChange={handleChange}
        />
      </div>
      <button onClick={handleSubmit}>Save</button>
      <button onClick={onClose}>Cancel</button>
    </div>
  );
};

const App = () => {
  const gridRef = useRef(null);
  const [rowData, setRowData] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  //Using states to set the current filters and sort models (to be built)
  const [filters, setFilters] = useState({});
  const [sortModel, setSortModel] = useState([]);
  const [optionsModel, setOptionsModel] = useState([]);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRowCount, setTotalRowCount] = useState(0);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date
      .toLocaleDateString("en-AU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
      .replace(/ /g, " ");
  };

  //Will process the filters, by using the current state of the filters and returning the entityOS version of the filters.
  const processFilters = (filters) => {
    console.log("These are my filters before processing:", filters);
    const processedFilters = [];

    Object.keys(filters).forEach((key) => {
      console.log(`Processing filter for key: ${key}`);
      const filter = filters[key];
      if (filter) {
        if (filter.values && filter.filterType === "set") {
          // Handle set filters such as the 'Status' column
          processedFilters.push({
            name: key,
            comparison: "IN_LIST",
            value1: filter.values.join(","), // Convert array of selected statuses to a comma-separated string
          });
        }

        if (filter.filterType === "date") {
          if (filter.dateFrom && filter.type === "equals") {
            const formattedDate = formatDate(filter.dateFrom);
            processedFilters.push({
              name: key,
              comparison: "EQUAL_TO",
              value1: formattedDate,
            });
          } else if (filter.filter === "not_null") {
            processedFilters.push({
              name: key,
              comparison: "IS_NOT_NULL",
            });
          } else if (filter.filter === "is_null") {
            processedFilters.push({
              name: key,
              comparison: "IS_NULL",
            });
          } else if (filter.dateFrom && filter.type === "greaterThan") {
            const formattedDate = formatDate(filter.dateFrom);
            processedFilters.push({
              name: key,
              comparison: "GREATER_THAN",
              value1: formattedDate,
            });
          } else if (filter.dateFrom && filter.type === "lessThan") {
            const formattedDate = formatDate(filter.dateFrom);
            processedFilters.push({
              name: key,
              comparison: "LESS_THAN",
              value1: formattedDate,
            });
          }
        } else if (filter.filter) {
          let comparisonType = "TEXT_IS_LIKE"; // Default can be overridden based on type
          if (filter.type === "number") {
            comparisonType = "NUMBER_EQUALS";
          }
          processedFilters.push({
            name: key,
            comparison: comparisonType,
            value1: filter.filter,
          });
        }
      }
    });

    console.log("Processed filters:", processedFilters);
    return processedFilters;
  };

  const parseDateFromEntityOS = (dateString) => {
    const [day, month, year] = dateString.split(" ");
    return new Date(`${month} ${day}, ${year}`);
  };

  //Controls the actual fetching of the Grid data itself
  const fetchGridData = async ({ queryKey }) => {
    console.log("Fetch called");
    //const [_key, { filters, sortModel }] = queryKey;

    const url = "/rpc/issue/?method=ISSUE_SEARCH";
    let criteria = {
      fields: [
        { name: "issue_reference" },
        { name: "issue_raiseddate" },
        { name: "issue_responsiblecontactpersontext" },
        { name: "issue_causecontactpersontext" },
        { name: "issue_responsiblecontactperson_streetstate" },
        { name: "issue_responsiblecontactperson_contactbusiness_tradename" },
        { name: "issue_responsiblecontactbusinesstext" },
        { name: "issue_seissueidentification" },
        { name: "issue_seimpact" },
        { name: "issue_title" },
        { name: "issue_statustext" },
      ],
      summaryFields: [{ name: "count(*) issuecount" }],
      filters: processFilters(filters),
      sorts: processSorts(sortModel),
      options: processOptions(optionsModel),
    };

    console.log(`Criteria sent to server:`, JSON.stringify(criteria, null, 2));

    // build up the params of entityOS needs it in criteria / JSON stringify structure
    const params = new URLSearchParams({ criteria: JSON.stringify(criteria) });
    const response = await axios.post(url, params, {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
    });

    // Check for error or empty response scenarios
    if (
      response.status !== 200 ||
      !response.data ||
      !response.data.data ||
      !response.data.data.rows
    ) {
      console.error("Invalid response:", response);
      throw new Error("Failed to fetch data or data format is incorrect");
    }

    // Extract total count from summary
    const totalCount = parseInt(response.data.summary.issuecount, 10) || 0; // Convert string to number 10) || 0;
    console.log("Total issue count: ", totalCount);

    // Parse and format the date fields in each row
    const rows = response.data.data.rows.map((row) => ({
      ...row,
      issue_raiseddate: row.issue_raiseddate
        ? parseDateFromEntityOS(row.issue_raiseddate)
        : null,
    }));

    console.log(
      `Received ${response.data.data.rows.length} rows from server. Total count: ${response.data.summary.issuecount}`
    );

    return {
      rows: rows,
      totalCount: totalCount,
    };
  };

  const { refetch } = useQuery(
    //removed data: rowData,
    ["gridData", { currentPage, pageSize, filters, sortModel }],
    () => fetchGridData({ filters, sortModel }),
    {
      enabled: false,
      refetchOnWindowFocus: false,
      refetchOnMount: false,
      keepPreviousData: true,
      onSuccess: (data) => {
        setRowData(data.rows); // Set the row data
        setTotalRowCount(data.totalCount); // Set the total row count
        console.log("Total issue count from fetch:", data.totalCount);
      },
    }
  );

  const onPaginationChanged = useCallback(() => {
    if (!gridRef.current) return;
    const newPage = gridRef.current.api.paginationGetCurrentPage() + 1;
    const newPageSize = gridRef.current.api.paginationGetPageSize();
    console.log(
      `Pagination changed. Current page: ${newPage}, Page size: ${newPageSize}`
    );
    const totalPages = gridRef.current.api.paginationGetTotalPages();
    console.log("Total pages:", totalPages);
    if (currentPage !== newPage || pageSize !== newPageSize) {
      console.log(
        `Updating page from ${currentPage} to ${newPage} and size from ${pageSize} to ${newPageSize}`
      );
      setCurrentPage(newPage);
      setPageSize(newPageSize);
      refetch();
    }
  }, [currentPage, pageSize, refetch]);

  //   const onPaginationChanged = useCallback(() => {
  //     if (!gridRef.current) return;
  //     const newPage = gridRef.current.api.paginationGetCurrentPage() + 1;
  //     if (currentPage !== newPage) {
  //       setCurrentPage(newPage);
  //       refetch();
  //     }
  //   }, [currentPage, refetch]);

  // const onFilterChanged = useCallback((event) => {
  //   const newFilters = event.api.getFilterModel();
  //   console.log("Current Filters:", newFilters);
  //   setFilters(newFilters);
  // }, []);

  //This function retains the issue_title filter (search input) even when it updates the state based on column filters
  // const onFilterChanged = useCallback((event) => {
  //   const columnFilters = event.api.getFilterModel();
  //   setFilters((currentFilters) => {
  //     return {
  //       ...currentFilters,
  //       ...columnFilters,
  //     };
  //   });
  // }, []);

  const onFilterChanged = useCallback(() => {
    const columnFilters = event.api.getFilterModel();

    // Filter out entries with empty values
    const filteredFilters = Object.entries(columnFilters)
      .filter(([key, value]) => value !== null && value !== undefined)
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});

    setFilters(filteredFilters);
  }, []);

  //This code allows me to remove filters properly but then I can't combine search input filtering with column filtering
  // const onFilterChanged = useCallback((event) => {
  //   // Get the current filter model from the grid
  //   const allFilters = event.api.getFilterModel();

  //   // Update the filters state based on the current grid filters
  //   setFilters(allFilters);
  // }, []);

  const debouncedSetSortModel = useCallback(
    debounce((newSortModel) => {
      setSortModel(newSortModel);
    }, 500),
    []
  ); // Ensure the debouncer isn't recreated on each render

  const onSortChanged = useCallback(() => {
    const allColumnsState = gridRef.current.api.getColumnState(); // Updated to use api.getColumnState()
    const sortedColumns = allColumnsState.filter((s) => s.sort);
    const newSortModel = sortedColumns.map(({ colId, sort }) => ({
      colId,
      sort,
    }));
    if (JSON.stringify(newSortModel) !== JSON.stringify(sortModel)) {
      debouncedSetSortModel(newSortModel);
    }
  }, [sortModel, debouncedSetSortModel]);

  const processSorts = (sortModel) => {
    return sortModel.map(({ colId, sort }) => ({
      name: colId, // Assuming colId corresponds directly to the field names expected by your backend
      direction: sort, // 'asc' or 'desc' as returned by AG-Grid
    }));
  };

  const processOptions = (optionsModel) => {
    
    const currentPage = gridRef.current.api.paginationGetCurrentPage();
    const pageSize = gridRef.current.api.paginationGetPageSize();
    
    let startRow = 0;
    if(currentPage === 0) {

    }
    else {
      //Work out where we should start this search
      startRow = startRow * (currentPage+1) * pageSize;
    }
   
    return {
      rf: "json",
      startrow: startRow, 
      rows: pageSize
    };
  };

  // useEffect to refetch data when filters or sortModel changes
  useEffect(() => {
    console.log("Refetching data due to sort or filter change");
    refetch();
  }, [filters, sortModel, currentPage, pageSize, refetch]);

  // const handleSearchChange = (searchValue) => {
  //   gridRef.current.api.setQuickFilter(searchValue);
  // };

  // const setDebouncedFilters = useCallback(debounce((searchValue) => {
  //   setFilters(filters => ({
  //     ...filters, // maintain other existing filters
  //     issue_title: { filterType: "text", filter: searchValue }
  //   }));
  // }, 500), []); // 500 ms delay

  //This function updates the filters for the "Title" column without affecting the other column filters
  const setDebouncedFilters = useCallback(
    debounce((searchValue) => {
      setFilters((filters) => {
        const updatedFilters = { ...filters };
        if (searchValue) {
          updatedFilters["issue_title"] = {
            filterType: "text",
            filter: searchValue,
          };
        } else {
          delete updatedFilters["issue_title"];
        }
        return updatedFilters;
      });
    }, 500),
    []
  ); // 500 ms delay

  const handleSearchChange = (searchValue) => {
    setDebouncedFilters(searchValue);
  };

  // const getRowHeight = useCallback((params) => {
  //   // You can customize this logic based on your application's requirements
  //   if (params.node.group) {  // Assuming grouping is used
  //     return 100;  // Height for group rows
  //   } else {
  //     return 25;  // Standard row height
  //   }
  // }, []);

  const handleAddNewClick = () => {
    setSelectedRowData(null); // Explicitly clear any selection
    setIsModalOpen(true);
  };

  const handleSaveNewRow = (newOrUpdatedRow) => {
    // Check if we're editing an existing row (indicated by the presence of an 'id')
    if (newOrUpdatedRow.id) {
      // Editing existing row
      // Make sure the object structure here matches what's expected by your grid and backend
      const updatedRows = rowData.map((row) =>
        row.id === newOrUpdatedRow.id
          ? {
              ...row,
              reference: newOrUpdatedRow.reference,
              title: newOrUpdatedRow.title,
            }
          : row
      );
      setRowData(updatedRows);
    } else {
      // Adding a new row
      // Generate a new unique ID for the new issue
      const newId =
        rowData.length > 0 ? Math.max(...rowData.map((r) => r.id)) + 1 : 1;
      // Ensure the new object structure matches your data model
      setRowData([
        ...rowData,
        {
          ...newOrUpdatedRow,
          id: newId,
          reference: newOrUpdatedRow.reference,
          title: newOrUpdatedRow.title,
        },
      ]);
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
    setRowData((currentRows) => currentRows.filter((row) => row !== rowData));
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
        <button
          onClick={() => handleEditClick(props.data)}
          style={{
            marginRight: 5,
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "#272D3B", // Sets the color for both icons
          }}
        >
          <i className="fas fa-edit"></i> {/* Font Awesome Edit Icon */}
        </button>
        <button
          onClick={() => handleDeleteClick(props.data)}
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            color: "#272D3B", // Ensures consistent color styling
          }}
        >
          <i className="fas fa-trash"></i> {/* Font Awesome Trash Icon */}
        </button>
      </div>
    );
  };

  const [selectedRowData, setSelectedRowData] = useState(null);

  const [columnDefs] = useState([
    {
      field: "issue_reference",
      headerName: "Reference",
      flex: 1,
      minWidth: 100,
      filter: "agTextColumnFilter",
    },
    {
      field: "issue_raiseddate",
      headerName: "Date",
      flex: 1,
      minWidth: 100,
      filter: "agDateColumnFilter",
      filterParams: {
        suppressAndOrCondition: true,
        comparator: (filterLocalDateAtMidnight, cellValue) => {
          if (!cellValue) {
            return 0; // Considered equal for `isNull` scenarios
          }
          // Convert string date to Date object for comparison
          const cellDateValue = new Date(cellValue);
          if (cellDateValue < filterLocalDateAtMidnight) {
            return -1; // Date is before the filter date
          } else if (cellDateValue > filterLocalDateAtMidnight) {
            return 1; // Date is after the filter date
          }
          return 0; // Dates are equal
        },
        browserDatePicker: true, // Enable browser date picker for easier date input
        inRangeInclusive: false,
        filterOptions: ["equals", "greaterThan", "lessThan"],
      },
      valueFormatter: (params) => {
        const formattedDate = formatDate(params.value);
        return formattedDate;
      },
    },
    {
      field: "issue_responsiblecontactpersontext",
      headerName: "Adviser",
      flex: 1,
      minWidth: 100,
      filter: "agTextColumnFilter",
      filterParams: { newRowsAction: "keep" },
    },
    {
      field: "issue_causecontactpersontext",
      headerName: "Responsible Person",
      flex: 1,
      minWidth: 100,
      filter: "agTextColumnFilter",
    },
    {
      field: "issue_responsiblecontactperson_streetstate",
      headerName: "State",
      flex: 1,
      minWidth: 100,
      filter: "agSetColumnFilter",
      filterParams: {
        suppressSelectAll: true,
        suppressMiniFilter: true,
        values: ["NSW", "VIC", "QLD", "WA", "SA", "TAS", "NT"],
      },
    },
    {
      field: "issue_responsiblecontactperson_contactbusiness_tradename",
      headerName: "Licensee",
      flex: 1,
      minWidth: 100,
      filter: "agTextColumnFilter",
    },
    {
      field: "issue_responsiblecontactbusinesstext",
      headerName: "Business",
      flex: 1,
      minWidth: 100,
      filter: "agTextColumnFilter",
    },
    {
      field: "issue_seissueidentification",
      headerName: "Source",
      flex: 1,
      minWidth: 100,
      filter: "agTextColumnFilter",
    },
    {
      field: "issue_seimpact",
      headerName: "Impact",
      flex: 1,
      minWidth: 100,
      filter: "agTextColumnFilter",
    },
    {
      field: "issue_title",
      headerName: "Title",
      flex: 1,
      minWidth: 100,
      filter: "agTextColumnFilter",
    },
    {
      field: "issue_statustext",
      headerName: "Status",
      flex: 1,
      minWidth: 100,
      filter: "agSetColumnFilter",
      filterParams: {
        suppressSelectAll: true,
        suppressMiniFilter: true,
        values: ["Not Started", "In Progress", "Completed", "Archived"],
      },
    },
    {
      field: "seclientobject1_firstname",
      headerName: "Manager",
      flex: 1,
      minWidth: 100,
      filter: "agTextColumnFilter",
    },
    {
      headerName: "Actions",
      cellRenderer: ActionsCellRenderer,
      editable: false,
      filter: false,
      sortable: false,
      minWidth: 180,
    },
  ]);

  const gridOptions = {
    // other grid options if necessary
    alwaysShowVerticalScroll: true, // This will ensure the scrollbar is always visible
    // defaultColDef: {
    //   flex: 1,
    //   minWidth: 100,
    //   filter: true,
    //   sortable: true,
    //   resizable: true,
    // },
    onModelUpdated: function(params) {
      // const currentPage = params.api.paginationGetCurrentPage();
      // const totalPages = params.api.paginationGetTotalPages();
      // console.log(`!!!!Now on page ${currentPage + 1} of ${totalPages}`);
    },
  };

  return (
    <div className="page-container">
      <Navbar onSearchChange={handleSearchChange} />
      <div className="grid-toolbar">
        <button className="btn" onClick={handleAddNewClick}>
          Add New
        </button>
        <button className="btn" onClick={onExportClick}>
          Export to Excel
        </button>
      </div>
      <NewRowModal
        isOpen={isModalOpen}
        onSave={handleSaveNewRow}
        onClose={() => setIsModalOpen(false)}
        editRow={selectedRowData}
      />
      <div className="ag-theme-alpine" style={{ height: 750, width: "100%" }}>
        <AgGridReact
          ref={gridRef}
          columnDefs={columnDefs}
          rowData={rowData}
          gridOptions={gridOptions}
          domLayout="normal"
          rowSelection="single"
          pagination={true}
          paginationPageSize={20}
          paginationTotalRowCount={totalRowCount}
          onFilterChanged={onFilterChanged}
          onSortChanged={onSortChanged}
          // Disable AG-Grid built-in filtering and sorting since server-side is used
          enableServerSideSorting={true}
          enableServerSideFilter={true}
          //onPaginationChanged={onPaginationChanged}
          serverSideInfiniteScroll="true"
          // getRowHeight={getRowHeight}
          //Added the line below for returning row ID
          // onRowClicked={onRowClicked}
        ></AgGridReact>
      </div>
    </div>
  );
};

export default App;
