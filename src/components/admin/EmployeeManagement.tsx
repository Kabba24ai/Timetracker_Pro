import React, { useEffect, useState } from 'react';
import { Users, Plus, Edit, Trash2, Save } from 'lucide-react';

interface Employee {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'employee' | 'admin';
  created_at: string;
  shift_start_time?: string;
  shift_end_time?: string;
  pay_start_buffer?: number;
  pay_end_buffer?: number;
  vacation_allotment_hours?: number;
  vacation_eligible?: boolean;
  vacation_start_days?: number;
}

// Mock employees for demo
const mockEmployees: Employee[] = [
  {
    id: '1',
    first_name: 'John',
    last_name: 'Doe',
    email: 'john@demo.com',
    role: 'employee',
    created_at: '2024-01-01T00:00:00Z',
    shift_start_time: '08:00',
    shift_end_time: '17:00',
    vacation_allotment_hours: 80,
    vacation_eligible: true,
    vacation_start_days: 90,
  },
  {
    id: '2',
    first_name: 'Admin',
    last_name: 'User',
    email: 'admin@demo.com',
    role: 'admin',
    created_at: '2024-01-01T00:00:00Z',
    shift_start_time: '09:00',
    shift_end_time: '18:00',
    vacation_allotment_hours: 120,
    vacation_eligible: true,
    vacation_start_days: 30,
  },
  {
    id: '3',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@demo.com',
    role: 'employee',
    created_at: '2024-01-15T00:00:00Z',
    shift_start_time: '07:00',
    shift_end_time: '16:00',
    vacation_allotment_hours: 0,
    vacation_eligible: false,
    vacation_start_days: 0,
  }
];

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editFormData, setEditFormData] = useState<Partial<Employee>>({});

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      // Use mock data for demo
      setEmployees(mockEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditFormData(employee);
    setShowEditForm(true);
  };

  const handleSaveEmployee = async () => {
    try {
      // In demo mode, just update local state
      setEmployees(prev => 
        prev.map(emp => 
          emp.id === editingEmployee?.id 
            ? { ...emp, ...editFormData }
            : emp
        )
      );
      setShowEditForm(false);
      setEditingEmployee(null);
      setEditFormData({});
    } catch (error) {
      console.error('Error saving employee:', error);
    }
  };

  const handleCancelEdit = () => {
    setShowEditForm(false);
    setEditingEmployee(null);
    setEditFormData({});
  };

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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4">
            <h3 className="text-xl font-bold text-gray-900 mb-6">
              Edit Employee - {editingEmployee.first_name} {editingEmployee.last_name}
            </h3>
            
            {/* View-Only Employee Information */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Employee Information (View Only - From Roles Module)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900">
                    {editingEmployee.first_name}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900">
                    {editingEmployee.last_name}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Employee Time Clock Code</label>
                  <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg text-gray-900">
                    {editingEmployee.id.padStart(4, '0')}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <div className="px-3 py-2 bg-white border border-gray-200 rounded-lg">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      editingEmployee.role === 'admin'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {editingEmployee.role}
                    </span>
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
                      onChange={(e) => setEditFormData(prev => ({ 
                        ...prev, 
                        vacation_eligible: e.target.checked,
                        vacation_allotment_hours: e.target.checked ? (prev.vacation_allotment_hours || 80) : 0,
                        vacation_start_days: e.target.checked ? (prev.vacation_start_days || 90) : 0
                      }))}
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
                    value={editFormData.vacation_allotment_hours || 0}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, vacation_allotment_hours: Number(e.target.value) }))}
                    disabled={!editFormData.vacation_eligible}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value={0}>0 hours</option>
                    <option value={8}>8 hours</option>
                    <option value={16}>16 hours</option>
                    <option value={24}>24 hours</option>
                    <option value={32}>32 hours</option>
                    <option value={40}>40 hours</option>
                    <option value={48}>48 hours</option>
                    <option value={56}>56 hours</option>
                    <option value={64}>64 hours</option>
                    <option value={72}>72 hours</option>
                    <option value={80}>80 hours</option>
                    <option value={88}>88 hours</option>
                    <option value={96}>96 hours</option>
                    <option value={104}>104 hours</option>
                    <option value={112}>112 hours</option>
                    <option value={120}>120 hours</option>
                    <option value={128}>128 hours</option>
                    <option value={136}>136 hours</option>
                    <option value={144}>144 hours</option>
                    <option value={152}>152 hours</option>
                    <option value={160}>160 hours</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Vacation Start
                  </label>
                  <select
                    value={editFormData.vacation_start_days || 90}
                    onChange={(e) => setEditFormData(prev => ({ ...prev, vacation_start_days: Number(e.target.value) }))}
                    disabled={!editFormData.vacation_eligible}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400"
                  >
                    <option value={0}>Immediate</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                    <option value={120}>120 days</option>
                    <option value={180}>180 days</option>
                    <option value={365}>1 year</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="flex items-center justify-end space-x-4">
              <button
                onClick={handleCancelEdit}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEmployee}
                className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Save className="h-4 w-4" />
                <span>Save Changes</span>
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
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Employee</span>
        </button>
      </div>

      <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-sm text-yellow-800">
          <strong>Demo Mode:</strong> This is showing mock employee data. In a real system, this would connect to your database.
        </p>
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
                      <p className="text-sm text-gray-500">ID: {employee.id.slice(0, 8)}...</p>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-gray-600">{employee.email}</td>
                  <td className="py-3 px-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        employee.role === 'admin'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {employee.role}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-gray-600">
                    {employee.shift_start_time && employee.shift_end_time
                      ? `${employee.shift_start_time} - ${employee.shift_end_time}`
                      : 'Not set'}
                  </td>
                  <td className="py-3 px-4">
                    {employee.vacation_eligible ? (
                      <div>
                        <span className="text-green-600 font-medium">
                          {employee.vacation_allotment_hours || 0} hrs/year
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
                      <button className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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