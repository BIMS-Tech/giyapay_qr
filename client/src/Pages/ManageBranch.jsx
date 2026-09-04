import React, { useState, useEffect } from 'react';
import { Button, Table, TableHead, TableBody, TableRow, TableCell, Box, Typography, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, useMediaQuery, Snackbar, Alert, TablePagination } from '@mui/material';
import { Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import RippleLoader from '../Components/Loader';

const ManageBranches = () => {
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [branchToDelete, setBranchToDelete] = useState(null);
  const [openSnackbar, setOpenSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const isTabletOrMobile = useMediaQuery('(max-width: 900px)');
  const location = useLocation();

  // Fetch all branches when component mounts
  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/branches/all`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setBranches(response.data);
      } catch (error) {
        console.error('Failed to fetch branches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBranches();
  }, []);

  // Handle successful branch create or edit
  useEffect(() => {
    if (location.state && location.state.successMessage) {
      setSnackbarMessage(location.state.successMessage);
      setSnackbarSeverity('success');
      setOpenSnackbar(true);
    }
  }, [location]);

  // Open delete confirmation dialog
  const openDeleteDialog = (branch) => {
    setBranchToDelete(branch);
    setDeleteDialogOpen(true);
  };

  // Close delete confirmation dialog
  const closeDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setBranchToDelete(null);
  };

  // Handle branch deletion
  const handleDelete = async () => {
    if (!branchToDelete) return;

    try {
      const response = await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/branches/${branchToDelete.id}`);
      setBranches(branches.filter((branch) => branch.id !== branchToDelete.id));
      setSnackbarMessage(response.data.message);
      setOpenSnackbar(true);
      closeDeleteDialog();
    } catch (error) {
      console.error('Failed to delete branch:', error);
      setSnackbarMessage(error.response?.data?.message || 'Failed to delete branch');
      setOpenSnackbar(true);
    }
  };

  // Handle page change in pagination
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  // Handle rows per page change
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Box className="manage-branches-container" sx={{ backgroundColor: 'white', padding: '20px' }}>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
          <RippleLoader />
        </Box>
      ) : (
        <>
          <Typography className="manage-branches-title" variant="h4" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
            Manage Branches
          </Typography>

          <Button
            component={Link}
            to="/super-dashboard/manage-branches/add"
            variant="contained"
            sx={{
              color: '#fff',
              backgroundImage: 'linear-gradient(to right, #FBB03A, #ED1F79, #FBB03A, #ED1F79)',
              backgroundSize: '300% 100%',
              border: 'none',
              transition: 'all 0.4s ease-in-out',
              padding: '8px 40px',
              borderRadius: '8px',
              fontFamily: 'Montserrat, sans-serif',
              fontWeight: 400,
              textTransform: 'none',
              '&:hover': {
                backgroundPosition: '100% 0',
              },
            }}
          >
            Create Branch
          </Button>

          {branches.length === 0 ? (
            <Typography>No branches found. Create a new branch to get started.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size={isTabletOrMobile ? 'small' : 'medium'}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>ID</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Branch Name</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Bank Name</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Bank Branch</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...branches]
                    .sort((a, b) => b.id - a.id)
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((branch) => (

                      <TableRow key={branch.id}>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{branch.id}</TableCell>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{branch.branch_name}</TableCell>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{branch.bank_name}</TableCell>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{branch.bank_branch}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                              component={Link}
                              to={`/super-dashboard/edit-branch/${branch.id}`}
                              variant="contained"
                              sx={{
                                maxWidth: '150px',
                                flex: 1,
                                backgroundColor: '#FBB03A',
                                color: 'black',
                                '&:hover': {
                                  backgroundColor: '#ED1F79',
                                },
                                fontFamily: 'Montserrat, sans-serif',
                                fontWeight: 400,
                              }}
                              startIcon={<EditIcon />}
                            >
                              Edit
                            </Button>
                            <Button
                              variant="contained"
                              sx={{
                                maxWidth: '150px',
                                flex: 1,
                                backgroundColor: '#ED1F79',
                                color: 'white',
                                '&:hover': {
                                  backgroundColor: '#FBB03A',
                                },
                                fontFamily: 'Montserrat, sans-serif',
                                fontWeight: 400,
                              }}
                              onClick={() => openDeleteDialog(branch)}
                              startIcon={<DeleteIcon />}
                            >
                              Delete
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Box>
          )}

          {/* Pagination */}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={branches.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{ mt: 2 }}
          />
        </>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={closeDeleteDialog}>
        <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Delete Branch</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
            Are you sure you want to delete this branch? If there are users associated with this branch, you must delete them first.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeDeleteDialog} sx={{ color: '#ED1F79' }}>
            Cancel
          </Button>
          <Button onClick={handleDelete} sx={{ color: '#FBB03A' }}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for Success/Error */}
      <Snackbar
        open={openSnackbar}
        onClose={() => setOpenSnackbar(false)}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbarSeverity} onClose={() => setOpenSnackbar(false)}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default ManageBranches;
