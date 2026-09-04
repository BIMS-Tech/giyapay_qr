import React, { useState, useEffect } from 'react';
import {
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Box,
  useMediaQuery,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  CircularProgress,
  Snackbar,
  Alert,
  TablePagination
} from '@mui/material';
import { Link } from 'react-router-dom';
import axios from 'axios';
import RippleLoader from '../Components/Loader';

const ManageUsers = () => {
  const [users, setUsers] = useState([]);
  const [open, setOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);
  const isMobile = useMediaQuery('(max-width: 600px)');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');

  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
  };

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${import.meta.env.VITE_BACKEND_URL}/users/all`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        });
        setUsers(response.data);
      } catch (error) {
        console.error('Failed to fetch users:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const handleDelete = async () => {
    try {
      await axios.delete(`${import.meta.env.VITE_BACKEND_URL}/users/delete/${selectedUserId}`);
      setUsers(users.filter((user) => user.id !== selectedUserId));
      setOpen(false);

      setSnackbarMessage('User deleted successfully.');
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Failed to delete user:', error);
      setSnackbarMessage('Failed to delete user.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  const handleClickOpen = (id) => {
    setSelectedUserId(id);
    setOpen(true);
  };

  const handleClose = () => {
    setOpen(false);
  };

  const toggleStatus = async (id, currentStatus) => {
    try {
      await axios.put(`${import.meta.env.VITE_BACKEND_URL}/users/edit_status/${id}`, {
        status: currentStatus === 'Active' ? 'Inactive' : 'Active',
      });
      setUsers(users.map(user => user.id === id ? { ...user, status: currentStatus === 'Active' ? 'Inactive' : 'Active' } : user));

      setSnackbarMessage(`User status changed to ${currentStatus === 'Active' ? 'Inactive' : 'Active'}.`);
      setSnackbarSeverity('success');
      setSnackbarOpen(true);
    } catch (error) {
      console.error('Failed to toggle user status:', error);
      setSnackbarMessage('Failed to change user status.');
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
    }
  };

  // Handle page change
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <>
      {loading ? (
        <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
          <RippleLoader />
        </Box>
      ) : (
        <Box p={3}>
          <Typography variant="h4" gutterBottom sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
            Manage Users
          </Typography>
          <Button
            variant="contained"
            color="primary"
            component={Link}
            to="/super-dashboard/manage-users/add"
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
            Add User
          </Button>
          {users.length === 0 ? (
            <Typography>No User found. Add a new User to get started.</Typography>
          ) : (
            <Box sx={{ overflowX: 'auto' }}>
              <Table size={isMobile ? 'small' : 'medium'}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>ID</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>First Name</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Last Name</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Username</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Email</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>User Type</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Status</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Branch</TableCell>
                    <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...users]
                    .sort((a, b) => b.id - a.id)
                    .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                    .map((user) => (
                      <TableRow key={user.id}>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{user.id}</TableCell>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{user.first_name}</TableCell>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{user.last_name}</TableCell>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{user.username}</TableCell>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{user.email}</TableCell>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{user.user_type}</TableCell>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>{user.status}</TableCell>
                        <TableCell sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
                          {user.user_type === 'Co-Admin' ? 'Bank' : user.branch ? user.branch.branch_name : 'No Branch Assigned'}
                        </TableCell>
                        <TableCell>
                          <Box display="flex" gap={1} flexDirection={isMobile ? 'column' : 'row'}>
                            <Button
                              variant="contained"
                              color="secondary"
                              onClick={() => handleClickOpen(user.id)}
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
                            >
                              Delete
                            </Button>
                            <Button
                              variant="contained"
                              color="primary"
                              component={Link}
                              to={`/super-dashboard/edit-users/${user.id}`}
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
                            >
                              Edit
                            </Button>
                            <Button
                              variant="contained"
                              color={user.status === 'Active' ? 'success' : 'inherit'}
                              onClick={() => toggleStatus(user.id, user.status)}
                              sx={{
                                maxWidth: '150px',
                                flex: 1,
                                backgroundColor: '#b3b3b3',
                                color: 'white',
                                '&:hover': {
                                  backgroundColor: '#FBB03A',
                                },
                                fontFamily: 'Montserrat, sans-serif',
                                fontWeight: 400,
                              }}
                            >
                              {user.status === 'Active' ? 'Active' : 'Inactive'}
                            </Button>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </Box>
          )}
          <TablePagination
            rowsPerPageOptions={[5, 10, 25]}
            component="div"
            count={users.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
          />

          {/* Delete Confirmation Dialog */}
          <Dialog open={open} onClose={handleClose}>
            <DialogTitle sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>Confirm Delete</DialogTitle>
            <DialogContent>
              <DialogContentText sx={{ fontFamily: 'Montserrat, sans-serif', fontWeight: 400 }}>
                Are you sure you want to delete this user? This action cannot be undone.
              </DialogContentText>
            </DialogContent>
            <DialogActions>
              <Button onClick={handleClose} color="primary" sx={{ color: '#ED1F79' }}>
                Cancel
              </Button>
              <Button onClick={handleDelete} color="secondary" sx={{ color: '#FBB03A' }}>
                Delete
              </Button>
            </DialogActions>
          </Dialog>

          {/* Snackbar */}
          <Snackbar
            open={snackbarOpen}
            autoHideDuration={6000}
            onClose={handleSnackbarClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert onClose={handleSnackbarClose} severity={snackbarSeverity}>
              {snackbarMessage}
            </Alert>
          </Snackbar>
        </Box>
      )}
    </>
  );
};

export default ManageUsers;
