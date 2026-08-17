import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Plus, Trash2, Users, X } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { ScheduleGroup, createGroup, deleteGroup, fetchGroups, updateGroup } from '../../lib/schedule';

// Lightweight reusable-group management: create / rename / set members / retire.
// A group is just a named, reusable employee list used by "Add Group" — editing
// it never touches schedules already created from a prior application.
interface Props {
  employees: { id: number; full_name: string }[];
  onClose: () => void;
  onChanged: () => void; // parent reloads its group list (e.g. Add Group dropdown)
}

type Editing = { id: number | null; name: string; memberIds: Set<number> };

const blank = (): Editing => ({ id: null, name: '', memberIds: new Set() });

const ScheduleGroupsModal: React.FC<Props> = ({ employees, onClose, onChanged }) => {
  const [groups, setGroups] = useState<ScheduleGroup[]>([]);
  const [editing, setEditing] = useState<Editing>(blank());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Employees are already alphabetical from the server; keep it deterministic here too.
  const sortedEmployees = useMemo(
    () => [...employees].sort((a, b) => a.full_name.toLowerCase().localeCompare(b.full_name.toLowerCase())),
    [employees],
  );

  const reload = async () => {
    try {
      const g = await fetchGroups();
      setGroups(g);
      onChanged();
    } catch {
      /* surfaced on next action */
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const edit = (g: ScheduleGroup) => {
    setError(null);
    setEditing({ id: g.id, name: g.name, memberIds: new Set(g.members.map((m) => m.id)) });
  };

  const toggle = (id: number) =>
    setEditing((e) => {
      const memberIds = new Set(e.memberIds);
      memberIds.has(id) ? memberIds.delete(id) : memberIds.add(id);
      return { ...e, memberIds };
    });

  const save = async () => {
    if (!editing.name.trim()) {
      setError('Give the group a name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const member_ids = [...editing.memberIds];
      if (editing.id) {
        await updateGroup(editing.id, { name: editing.name.trim(), member_ids });
      } else {
        await createGroup({ name: editing.name.trim(), member_ids });
      }
      setEditing(blank());
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not save the group.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g: ScheduleGroup) => {
    setSaving(true);
    setError(null);
    try {
      await deleteGroup(g.id);
      if (editing.id === g.id) setEditing(blank());
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.firstError() : 'Could not delete the group.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Users className="h-5 w-5" /> Work Schedule Groups
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-0 divide-x">
          {/* Existing groups */}
          <div className="p-4 space-y-1">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Groups</p>
              <button
                type="button"
                onClick={() => setEditing(blank())}
                className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                <Plus className="h-4 w-4" /> New Group
              </button>
            </div>
            {groups.length === 0 && <p className="text-sm text-gray-400 py-4">No groups yet. Create one on the right.</p>}
            {groups.map((g) => (
              <div
                key={g.id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 cursor-pointer ${editing.id === g.id ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                onClick={() => edit(g)}
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{g.name}</p>
                  <p className="text-xs text-gray-400">{g.members.length} member{g.members.length === 1 ? '' : 's'}</p>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); remove(g); }}
                  disabled={saving}
                  className="text-gray-300 hover:text-red-500 disabled:opacity-40"
                  aria-label={`Delete ${g.name}`}
                  title="Delete group"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Editor */}
          <div className="p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{editing.id ? 'Edit Group' : 'New Group'}</p>
            <label className="block text-xs font-medium text-gray-600 mb-1">Group Name</label>
            <input
              type="text"
              value={editing.name}
              onChange={(e) => setEditing((s) => ({ ...s, name: e.target.value }))}
              placeholder="e.g. Bon Aqua Crew"
              aria-label="Group Name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />

            <p className="text-xs font-medium text-gray-600 mb-1">Members</p>
            <div className="border border-gray-200 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-50">
              {sortedEmployees.map((e) => (
                <label key={e.id} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-50 cursor-pointer">
                  <input type="checkbox" checked={editing.memberIds.has(e.id)} onChange={() => toggle(e.id)} className="rounded" />
                  <span>{e.full_name}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              {editing.id && (
                <button type="button" onClick={() => setEditing(blank())} className="px-4 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50">
                  Cancel Edit
                </button>
              )}
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-sm"
              >
                {saving ? 'Saving…' : editing.id ? 'Save Group' : 'Create Group'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScheduleGroupsModal;
