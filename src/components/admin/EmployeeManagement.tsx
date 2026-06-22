import React, { useEffect, useState } from 'react';
import { Users, Plus, Edit, Trash2, Save } from 'lucide-react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { Employee } from '../../types/employee';
import { formatTime12h } from '../../utils/time';

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Employee>>({});

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(30);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [vacationHours, setVacationHours] = useState<any[]>([]);
  const [vacationDays, setVacationDays] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);


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
      setVacationDays(res.data.days);
    } catch (error) {
      console.error('Vacation options error:', error);
    }
  };


  useEffect(() => {
    // fetchEmployees(Math.max(1, page));
    fetchEmployees();
  }, [page, perPage]);


  useEffect(() => {
    setPage(1);
  }, [perPage]);


  const fetchEmployees = async () => {
    try {
      setLoading(true);

      const res = await api.get<{
        data: Employee[];
        meta: {
          current_page: number;
          last_page: number;
          per_page: number;
          total: number;
        };
      }>(`/users?page=${page}&per_page=${perPage}`);

      if (!res.success) {
        toast.error(res.message || 'Failed to fetch employees');
        return;
      }

      setEmployees(res.data);
      setPage(res.meta.current_page);
      setLastPage(res.meta.last_page);
      setTotal(res.meta.total);


    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };


  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);

    setEditFormData({
      vacation_eligible: employee.vacation_eligible ?? false,
      vacation_allotment_hour_id: employee.vacation_allotment_hour_id
        ?? employee.vacation_allotment_hour?.id
        ?? null,
      vacation_start_day_id: employee.vacation_start_day_id
        ?? employee.vacation_start_day?.id
        ?? null,

      bonus_vacation_hours: employee.bonus_vacation_hours ?? 0,
      bonus_vacation_hours_start_date: employee.bonus_vacation_hours_start_date ?? '',
      bonus_vacation_hours_end_date: employee.bonus_vacation_hours_end_date ?? '',
    });

    setShowEditForm(true);
  };

  const handleSaveEmployee = async () => {
    if (!editingEmployee || saving) return;

    setSaving(true);

    try {
      const payload = {
        vacation_eligible: editFormData.vacation_eligible ?? false,
        vacation_allotment_hour_id: editFormData.vacation_allotment_hour_id ?? null,
        vacation_start_day_id: editFormData.vacation_start_day_id ?? null,
          
        bonus_vacation_hours: editFormData.bonus_vacation_hours ?? 0,
        bonus_vacation_hours_start_date: editFormData.bonus_vacation_hours_start_date ?? null,
        bonus_vacation_hours_end_date: editFormData.bonus_vacation_hours_end_date ?? null,
      };

      const res = await api.put(
        `/users/${editingEmployee.id}/vacation`,
        payload
      );

      if (!res.success) {
        toast.error(res.message || 'Failed to update vacation settings');
        return;
      }

      setEmployees(prev =>
        prev.map(emp =>
          emp.id === editingEmployee.id ? res.data : emp
        )
      );

      toast.success('Vacation settings updated successfully');

      setShowEditForm(false);
      setEditingEmployee(null);
      setEditFormData({});
    } catch (error) {
      console.error('Save vacation error:', error);
      toast.error('Something went wrong while saving');
    } finally {
      setSaving(false);
    }
  };



  const handleCancelEdit = () => {
    setShowEditForm(false);
    setEditingEmployee(null);
    setEditFormData({});
  };

  const from = total === 0
    ? 0
    : Math.min((page - 1) * perPage + 1, total);

  const to = Math.min(page * perPage, total);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
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
      {showEditForm && editingEmployee && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white rounded-xl shadow-xl p-4 w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
            {/* <h3 className="text-xl font-bold text-gray-900 mb-6">
              Edit Employee - {editingEmployee.first_name} {editingEmployee.last_name}
            </h3> */}

            {/* Header */}
            <div className="p-2  border-b">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                Edit Employee – {editingEmployee.first_name} {editingEmployee.last_name}
              </h3>
            </div>

            {/* Scrollable Content */}
            <div className="p-4 sm:p-6 overflow-y-auto flex-1">
              {/* View-Only Employee Information */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Employee Information (View Only - From Roles Module)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <div className="px-3 py-2  border border-gray-200 rounded-lg text-gray-400 bg-gray-100 ">
                      {editingEmployee.first_name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <div className="px-3 py-2  border border-gray-200 rounded-lg text-gray-400 bg-gray-100">
                      {editingEmployee.last_name}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Employee Time Clock Code</label>
                    <div className="px-3 py-2  border border-gray-200 rounded-lg text-gray-400 bg-gray-100">
                      {editingEmployee.employee_code}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Roles</label>

                    <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-lg flex flex-wrap gap-2">
                      {editingEmployee.roles_name && editingEmployee.roles_name.length > 0 ? (
                        editingEmployee.roles_name.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${role.includes('master_admin')
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                              }`}
                          >
                            {role.replace('_', ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-gray-400">No roles assigned</span>
                      )}
                    </div>
                  </div>

                </div>
              </div>

              {/* Editable Vacation Settings */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <h4 className="text-sm font-semibold text-blue-900 mb-4">Vacation Settings</h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vacation Eligible
                    </label>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={editFormData.vacation_eligible || false}
                        onChange={(e) =>
                          setEditFormData(prev => ({
                            ...prev,
                            vacation_eligible: e.target.checked,
                            vacation_allotment_hour_id: e.target.checked ? prev.vacation_allotment_hour_id : null,
                            vacation_start_day_id: e.target.checked ? prev.vacation_start_day_id : null,
                          }))
                        }

                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="ml-2 text-sm text-gray-700">Enable vacation</span>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vacation Hours (Annual)
                    </label>


                    <select
                      value={editFormData.vacation_allotment_hour_id || ''}
                      onChange={(e) =>
                        setEditFormData(prev => ({
                          ...prev,
                          vacation_allotment_hour_id: Number(e.target.value),
                        }))
                      }
                      disabled={!editFormData.vacation_eligible}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">Select hours</option>

                      {vacationHours.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Vacation Start
                    </label>

                    <select
                      value={editFormData.vacation_start_day_id || ''}
                      onChange={(e) =>
                        setEditFormData(prev => ({
                          ...prev,
                          vacation_start_day_id: Number(e.target.value),
                        }))
                      }
                      disabled={!editFormData.vacation_eligible}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                    >
                      <option value="">Select start day</option>

                      {vacationDays.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>

                  </div>


                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bonus Vacation Hours
                    </label>
                    <input
                      type="number"
                      value={editFormData.bonus_vacation_hours || ''}
                      onChange={(e) =>
                        setEditFormData(prev => ({
                          ...prev,
                          bonus_vacation_hours: Number(e.target.value),
                        }))
                      }
                      disabled={!editFormData.vacation_eligible}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bonus Vacation Start 
                    </label>
                    <input
                      type="date"
                      value={editFormData.bonus_vacation_hours_start_date || ''}
                      onChange={(e) =>
                        setEditFormData(prev => ({
                          ...prev,
                          bonus_vacation_hours_start_date: e.target.value,
                        }))
                      }
                      disabled={!editFormData.vacation_eligible}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Bonus Vacation End 
                    </label>
                    <input
                      type="date"
                      value={editFormData.bonus_vacation_hours_end_date || ''}
                      onChange={(e) =>
                        setEditFormData(prev => ({
                          ...prev,
                          bonus_vacation_hours_end_date: e.target.value,
                        }))
                      }
                      disabled={!editFormData.vacation_eligible}
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

            </div>


            <div className="flex items-center justify-end gap-3 p-4 border-t bg-white sticky bottom-0">

              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmployee}
                disabled={saving}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors
                  ${saving
                    ? 'bg-blue-400 cursor-not-allowed text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
              >
                {saving ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v8H4z"
                      />
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>

            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <Users className="h-6 w-6 text-gray-600" />
          <h2 className="text-2xl font-bold text-gray-900">Employee Management</h2>
        </div>

      </div>


      <div className="bg-gray-50 rounded-lg p-4">

        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-medium text-gray-900">Name</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Email</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Role</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Shift Hours</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Vacation</th>
                <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((employee) => (
                <tr key={employee.id} className="border-b border-gray-100 hover:bg-white">
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-gray-900">
                        {employee.first_name} {employee.last_name}
                      </p>
                      <p className="text-sm text-gray-500">  ID: {employee.employee_code}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{employee.email}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {employee.roles_name && employee.roles_name.length > 0 ? (
                        employee.roles_name.map((role) => (
                          <span
                            key={role}
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${role.includes('master_admin')
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                              }`}
                          >
                            {role.replace('_', ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full  bg-gray-100 text-gray-800">Employee</span>
                      )}
                    </div>
                  </td>
                  {/* 
                  <td className="py-3 px-4 text-gray-600">
                    {employee.shift_start_time && employee.shift_end_time
                      ? `${formatTime12h(employee.shift_start_time)} - ${formatTime12h(employee.shift_end_time)}`
                      : 'Not set'}
                  </td> */}

                  <td className="py-3 px-4 text-gray-600">
                    {employee.store?.today_schedule &&
                      !employee.store.today_schedule.is_closed &&
                      employee.store.today_schedule.open &&
                      employee.store.today_schedule.close
                      ? `${formatTime12h(employee.store.today_schedule.open)} - ${formatTime12h(employee.store.today_schedule.close)}`
                      : '-'}
                  </td>


                  <td className="py-3 px-4">
                    {employee.vacation_eligible ? (
                      <div>
                        <span className="text-green-600 font-medium">
                          {employee.vacation_allotment_hour?.hours ?? 0} hrs/year
                        </span>
                        <div className="text-xs text-gray-500">Eligible</div>
                      </div>
                    ) : (
                      <div>
                        <span className="text-gray-400">Not eligible</span>
                        <div className="text-xs text-gray-500">0 hrs/year</div>
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleEditEmployee(employee)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      {/* <button className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button> */}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
          {/* Left: page info */}
          <p className="text-sm text-gray-600">
            Showing <span className="font-medium">{from}</span> to{' '}
            <span className="font-medium">{to}</span> of{' '}
            <span className="font-medium">{total}</span> results
          </p>


          {/* Right: controls */}
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
                {[5, 10, 30, 50, 100, 500].map(size => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
            </div>

            {/* Prev / Next */}
            <div className="flex gap-2">
              <button
                disabled={loading || page === 1}
                onClick={() => setPage(p => Math.max(p - 1, 1))}
                className="px-3 py-1 rounded border text-sm
                   disabled:opacity-50 disabled:cursor-not-allowed
                   hover:bg-gray-100"
              >
                Prev
              </button>

              <button
                disabled={loading || page === lastPage}
                onClick={() => setPage(p => Math.min(p + 1, lastPage))}
                className="px-3 py-1 rounded border text-sm
                   disabled:opacity-50 disabled:cursor-not-allowed
                   hover:bg-gray-100"
              >
                Next
              </button>
            </div>
          </div>
        </div>

        {employees.length === 0 && (
          <div className="text-center py-8">
            <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">No employees found.</p>
            <p className="text-sm text-gray-400 mt-1">Add employees to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EmployeeManagement;