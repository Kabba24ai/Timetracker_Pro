import React, { useState, useEffect } from 'react';
import { Calendar, Edit, Save, X, Check, AlertCircle } from 'lucide-react';
import { api } from '../../lib/api';
import { Confirm } from '../../lib/confirm';
import {
  VacationRequest
} from '../../types';

import toast from 'react-hot-toast';

interface VacationRecord {
  id?: string;
  employee_id: string;
  employee_name: string;
  allotted_hours: number;
  accrued_hours: number;
  used_hours: number;
  vacation_allotment_hour_id?: number | null;
}

const VacationManagement: React.FC = () => {
  const [vacationRecords, setVacationRecords] = useState<VacationRecord[]>([]);
  const [vacationRequests, setVacationRequests] = useState<VacationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
  vacation_allotment_hour_id: number | null;
  allotted_hours: number;
  used_hours: number;
}>({
  vacation_allotment_hour_id: null,
  allotted_hours: 0,
  used_hours: 0,
});

  const [activeTab, setActiveTab] = useState<'balances' | 'requests'>('balances');
const [vacationHours, setVacationHours] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

    const [perPage, setPerPage] = useState(10);

    const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchVacationRequests();
  }, []);

  useEffect(() => {
    fetchVacationRecords();
  }, [currentPage, perPage]);

  useEffect(() => {
    setCurrentPage(1);
  }, [perPage]);

useEffect(() => {
  fetchVacationOptions();
}, []);

const fetchVacationOptions = async () => {
  try {
    const res = await api.get('/users/vacation-Option');

    if (!res.success) {
      toast.error(res.message || 'Failed to load vacation options');
      return;
    }

    setVacationHours(res.data.hours);
  } catch (error) {
    console.error('Vacation options error:', error);
  }
};



  const fetchVacationRecords = async () => {
    try {
      setLoading(true);

      const response = await api.get(
        `/vacation/get-vacation-balances?page=${currentPage}&per_page=${perPage}`
      );

      if (response.success) {
        setVacationRecords(response.data);
        setCurrentPage(response.meta.current_page);
        setLastPage(response.meta.last_page);
        setTotal(response.meta.total);
      } else {
        setVacationRecords([]);
      }
    } catch (error) {
      console.error('Error fetching vacation records:', error);
      setVacationRecords([]);
    } finally {
      setLoading(false);
    }
  };



  const fetchVacationRequests = async () => {
    try {
      const res = await api.get('/vacation/all/vacation-requests');
      if (res.success) {
        setVacationRequests(res.data);
      }
    } catch (error) {
      console.error('Error fetching vacation requests', error);
    }
  };


  const handleApproveRequest = async (requestId: string) => {

      const result = await Confirm.fire({
            title: 'Approve Vacation?',
            text: 'Are you sure you want to approve this vacation request?',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Yes, approve',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#16a34a',
          });

          if (!result.isConfirmed) return;

  try {
    const res = await api.post(
      `/vacation/vacation-requests/${requestId}/approve`
    );

    if (!res.success) {
      console.error(res.message);
       toast.error(res.message || 'Failed to approve vacation request');
      return;
    }

     toast.success('Vacation request approve');

    // Refresh data from backend
    await fetchVacationRequests();
    await fetchVacationRecords();
  } catch (error) {
    console.error('Error approving vacation request:', error);
  }
};


  const handleDenyRequest = async (requestId: string) => {

      const result = await Confirm.fire({
          title: 'Deny Vacation Request',
          input: 'textarea',
          inputLabel: 'Reason for denial',
          inputPlaceholder: 'Enter reason...',
          inputAttributes: {
            maxlength: '255',
          },
          showCancelButton: true,
          confirmButtonText: 'Deny Request',
          confirmButtonColor: '#dc2626',
          cancelButtonText: 'Cancel',
          preConfirm: (reason) => {
            if (!reason || reason.trim().length < 3) {
              Confirm.showValidationMessage('Please provide a valid reason');
              return false;
            }
            return reason;
          },
        });

        if (!result.isConfirmed) return;

    try {

      const res = await api.post(
        `/vacation/vacation-requests/${requestId}/deny`,
        {
          reason: result.value,
        }
      );

      if (!res.success) {
        toast.error(res.message || 'Failed to deny vacation request');
        return;
      }

      toast.success('Vacation request denied');

      await fetchVacationRequests();
      await fetchVacationRecords();
    } catch (error) {
      console.error('Error denying vacation request:', error);
      toast.error('Something went wrong');
    }
  };



const startEditing = (record: VacationRecord) => {
  setEditingId(record.employee_id);

  setEditValues({
    vacation_allotment_hour_id: record.vacation_allotment_hour_id ?? null,
    allotted_hours: record.allotted_hours,
    used_hours: record.used_hours,
  });
};


  // const saveChanges = async (employeeId: string) => {
  //   try {
  //     // In demo mode, just update local state
  //     setVacationRecords(prev =>
  //       prev.map(record =>
  //         record.employee_id === employeeId
  //           ? { ...record, ...editValues }
  //           : record
  //       )
  //     );

  //     setEditingId(null);
  //   } catch (error) {
  //     console.error('Error saving vacation data:', error);
  //   }
  // };


  const saveChanges = async (employeeId: string) => {
    try {
      if (!editValues.vacation_allotment_hour_id) {
        toast.error('Please select allotted hours');
        return;
      }

      const res = await api.post(
        `/vacation/update-user-vacation/${employeeId}`,
        {
          vacation_allotment_hour_id: editValues.vacation_allotment_hour_id,
          used_hours: editValues.used_hours,
        }
      );

      if (!res.success) {
        toast.error(res.message || 'Failed to update vacation balance');
        return;
      }

      toast.success('Vacation balance updated');

      // Refresh from backend (SOURCE OF TRUTH)
      await fetchVacationRecords();

      setEditingId(null);
    } catch (error) {
      console.error('Error saving vacation data:', error);
      toast.error('Something went wrong');
    }
  };





  const cancelEditing = () => {
    setEditingId(null);
    setEditValues({ allotted_hours: 0, used_hours: 0 });
  };

  const from = total === 0 ? 0 : Math.min((currentPage - 1) * perPage + 1, total);

  const to = Math.min(currentPage * perPage, total);


  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Calendar className="h-6 w-6 text-gray-600" />
        <h2 className="text-2xl font-bold text-gray-900">Vacation Management</h2>
      </div>

      <div className="mb-6">
        <nav className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('balances')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'balances'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <Calendar className="h-5 w-5" />
            <span>Vacation Balances</span>
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-md font-medium transition-colors ${activeTab === 'requests'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
              }`}
          >
            <AlertCircle className="h-5 w-5" />
            <span>Vacation Requests</span>
            {vacationRequests.filter(req => req.status === 'pending').length > 0 && (
              <span className="bg-red-500 text-white text-xs rounded-full px-2 py-1 min-w-[20px] text-center">
                {vacationRequests.filter(req => req.status === 'pending').length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {activeTab === 'requests' && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Vacation Requests</h3>

          {vacationRequests.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <p className="text-gray-500">No vacation requests found.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {vacationRequests.map((request) => (
                <div key={request.id} className="bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-4">
                        <div>
                          <p className="font-medium text-gray-900">{request.employee_name}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(request.start_date).toLocaleDateString()} - {new Date(request.end_date).toLocaleDateString()}
                          </p>
                          <p className="text-sm font-semibold text-blue-600">
                            {request.hours} hours ({Math.ceil(request.hours / 8)} work days)
                          </p>
                          <p className="text-xs text-gray-500">
                            Requested on {new Date(request.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div>
                          <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full ${request.status === 'approved' ? 'bg-green-100 text-green-800' :
                            request.status === 'denied' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                            {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                          </span>
                        </div>
                        

                      </div>
                      {request.status === 'denied' && request.denial_reason && (
                          <div className="mt-2 rounded-md bg-red-50 border border-red-200 p-2">
                            <p className="text-xs font-semibold text-red-700">Denial Reason</p>
                            <p className="text-sm text-red-600 italic">
                              {request.denial_reason}
                            </p>
                          </div>
                        )}
                    </div>

                    {request.status === 'pending' && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleApproveRequest(request.id)}
                          className="flex items-center space-x-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors"
                        >
                          <Check className="h-4 w-4" />
                          <span>Approve</span>
                        </button>
                        <button
                         onClick={() => handleDenyRequest(request.id)}
                          className="flex items-center space-x-1 bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
                        >
                          <X className="h-4 w-4" />
                          <span>Deny</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'balances' && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Employee</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Allotted Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Accrued Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Used Hours</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Available</th>
                  <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vacationRecords.map((record) => {
                  const available = record.accrued_hours - record.used_hours;
                  const isEditing = editingId === record.employee_id;

                  return (
                    <tr key={record.employee_id} className="border-b border-gray-100 hover:bg-white">
                      <td className="py-3 px-4 font-medium text-gray-900">{record.employee_name}</td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editValues.vacation_allotment_hour_id ?? ''}
                            onChange={(e) => {
                              const selectedId = Number(e.target.value);
                              const selectedOption = vacationHours.find(v => v.id === selectedId);

                              setEditValues(prev => ({
                                ...prev,
                                vacation_allotment_hour_id: selectedId,
                                allotted_hours: selectedOption?.hours ?? 0,
                              }));
                            }}
                            className="w-40 px-2 py-1 border border-gray-300 rounded-md text-sm
                              focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="">Select hours</option>

                            {vacationHours.map(item => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="text-gray-600">{record.allotted_hours}</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-blue-600 font-semibold">
                        {record.accrued_hours.toFixed(1)}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.used_hours}
                            onChange={(e) => setEditValues(prev => ({
                              ...prev,
                              used_hours: Number(e.target.value)
                            }))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                            min="0"
                            step="0.5"
                          />
                        ) : (
                          <span className="text-red-600">{record.used_hours}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`font-semibold ${available > 0 ? 'text-green-600' : 'text-gray-600'
                            }`}
                        >
                          {available.toFixed(1)}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <div className="flex items-center space-x-2">
                            {/* <button
                              onClick={() => saveChanges(record.employee_id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded"
                            >
                              <Save className="h-4 w-4" />
                            </button> */}

                            <button
                              disabled={!editValues.vacation_allotment_hour_id}
                              onClick={() => saveChanges(record.employee_id)}
                              className="p-1 text-green-600 hover:bg-green-50 rounded
                                disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Save className="h-4 w-4" />
                            </button>

                            <button
                              onClick={cancelEditing}
                              className="p-1 text-gray-600 hover:bg-gray-50 rounded"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(record)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

         <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
  {/* Left */}
  <p className="text-sm text-gray-600">
    Showing <span className="font-medium">{from}</span> to{' '}
    <span className="font-medium">{to}</span> of{' '}
    <span className="font-medium">{total}</span> results
  </p>

  {/* Right */}
  <div className="flex items-center gap-3">
    {/* Rows per page */}
    <div className="flex items-center gap-2">
      <label className="text-sm text-gray-600">Rows:</label>
      <select
        value={perPage}
        onChange={(e) => setPerPage(Number(e.target.value))}
        className="px-2 py-1 border border-gray-300 rounded-md text-sm
          focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {[5, 10, 30, 50,100,500].map(size => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>

    {/* Prev / Next */}
    <div className="flex gap-2">
      <button
        disabled={loading || currentPage === 1}
        onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
        className="px-3 py-1 rounded border text-sm
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:bg-gray-100"
      >
        Prev
      </button>

      <button
        disabled={loading || currentPage === lastPage}
        onClick={() => setCurrentPage(p => Math.min(p + 1, lastPage))}
        className="px-3 py-1 rounded border text-sm
          disabled:opacity-50 disabled:cursor-not-allowed
          hover:bg-gray-100"
      >
        Next
      </button>
    </div>
  </div>
        </div>


        </div>
      )}

      <div className="mt-4 text-sm text-gray-500 space-y-1">
        <p>• Vacation accrues at 1 hour per 26 hours worked</p>
        <p>• Allotted hours represent the annual vacation allowance</p>
        <p>• Used hours can be manually adjusted for vacation requests</p>
        <p>• Approved vacation requests automatically update used hours</p>
      </div>
    </div>
  );
};

export default VacationManagement;