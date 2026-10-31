import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth.js';
import { useSocket } from '../hooks/useSocket.js';
import taskService from '../services/taskService.js';
import api from '../services/api.js';
import { StatusBadge, PriorityBadge, RoleBadge } from '../components/common/Badge.jsx';
import Button from '../components/common/Button.jsx';
import LoadingSpinner from '../components/common/LoadingSpinner.jsx';
import { formatDate, getInitials } from '../utils/helpers.js';
import { TASK_STATUS, TASK_PRIORITY, STATUS_CONFIG } from '../utils/constants.js';
import {
  Plus,
  Trash2,
  Edit2,
  Calendar,
  User as UserIcon,
  Search,
  Filter,
  Layers,
  Clock,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Eye,
  X,
  Kanban,
  List,
  AlertTriangle,
} from 'lucide-react';

const KANBAN_COLUMNS = [
  { id: TASK_STATUS.PENDING, title: 'Pending', icon: Clock, color: 'text-amber-400' },
  { id: TASK_STATUS.IN_PROGRESS, title: 'In Progress', icon: RotateCcw, color: 'text-sky-400' },
  { id: TASK_STATUS.COMPLETED, title: 'Completed', icon: CheckCircle2, color: 'text-emerald-400' },
];

export const TasksPage = () => {
  const { user } = useAuth();
  const { socketService } = useSocket();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('board'); // 'board' | 'list'

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  // Drag and drop state
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [activeTask, setActiveTask] = useState(null);

  // Form state
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState('medium');
  const [formStatus, setFormStatus] = useState('pending');
  const [formDueDate, setFormDueDate] = useState('');
  const [formAssignedTo, setFormAssignedTo] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Alert banner
  const [alertInfo, setAlertInfo] = useState(null);

  const showAlert = (message, type = 'success') => {
    setAlertInfo({ message, type });
    setTimeout(() => setAlertInfo(null), 4000);
  };

  // Fetch tasks
  const fetchTasks = async () => {
    try {
      const res = await taskService.getTasks({ limit: 100 });
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error('Failed to load tasks', err);
      showAlert(err.message || 'Failed to load tasks', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Fetch team directory for assignment dropdown
  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data.users || []);
    } catch (err) {
      console.error('Failed to load team users', err);
    }
  };

  useEffect(() => {
    fetchTasks();
    if (['admin', 'manager'].includes(user?.role)) {
      fetchUsers();
    }
  }, []);

  // Real-time synchronization: sync tasks when other users make changes
  useEffect(() => {
    if (!socketService) return;

    const unsubscribe = socketService.subscribeToTaskUpdates({
      onCreated: (data) => {
        fetchTasks();
        showAlert(`Real-time: Task "${data.title || 'New Task'}" was created`, 'info');
      },
      onUpdated: (data) => {
        fetchTasks();
      },
      onStatusChanged: (data) => {
        fetchTasks();
        showAlert(`Real-time: Task moved to ${data.status}`, 'info');
      },
      onReordered: () => {
        fetchTasks();
      },
      onDeleted: () => {
        fetchTasks();
        showAlert('Real-time: A task was deleted', 'info');
      },
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [socketService]);

  // Filtered users available for assignment based on role
  const assignableUsers = useMemo(() => {
    if (user?.role === 'admin') {
      return users; // Admin can assign to users and managers
    }
    if (user?.role === 'manager') {
      return users.filter((u) => u.role === 'user'); // Manager can only assign to regular users
    }
    return [];
  }, [users, user?.role]);

  // Authorization checks
  const canCreate = ['admin', 'manager'].includes(user?.role);

  const canEdit = (task) => {
    if (!task) return false;
    if (user?.role === 'admin') return true;
    if (user?.role === 'manager') {
      return String(task.createdBy?._id || task.createdBy) === String(user?._id);
    }
    return false;
  };

  const canDelete = (task) => {
    if (!task) return false;
    if (user?.role === 'admin') return true;
    if (user?.role === 'manager') {
      return String(task.createdBy?._id || task.createdBy) === String(user?._id);
    }
    return false;
  };

  const canChangeStatus = (task) => {
    if (!task) return false;
    if (user?.role === 'admin') return true;
    if (user?.role === 'manager') {
      return (
        String(task.createdBy?._id || task.createdBy) === String(user?._id) ||
        String(task.assignedTo?._id || task.assignedTo) === String(user?._id)
      );
    }
    // Regular user
    return (
      String(task.assignedTo?._id || task.assignedTo) === String(user?._id) ||
      String(task.createdBy?._id || task.createdBy) === String(user?._id)
    );
  };

  // Drag and drop handlers
  const handleDragStart = (e, taskId) => {
    setDraggedTaskId(taskId);
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== columnId) {
      setDragOverColumn(columnId);
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e, targetStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData('text/plain') || draggedTaskId;
    if (!taskId) return;

    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === targetStatus) return;

    if (!canChangeStatus(task)) {
      showAlert('You are not authorized to update progress on this task.', 'error');
      return;
    }

    // Optimistic UI update
    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t._id === taskId ? { ...t, status: targetStatus } : t))
    );

    try {
      await taskService.updateTaskStatus(taskId, targetStatus);
      showAlert(`Task moved to ${STATUS_CONFIG[targetStatus]?.label || targetStatus}!`);
    } catch (err) {
      setTasks(previousTasks);
      showAlert(err.message || 'Failed to update task status', 'error');
    } finally {
      setDraggedTaskId(null);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormTitle('');
    setFormDescription('');
    setFormPriority('medium');
    setFormStatus('pending');
    setFormDueDate('');
    setFormAssignedTo('');
    setIsCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (task) => {
    setActiveTask(task);
    setFormTitle(task.title || '');
    setFormDescription(task.description || '');
    setFormPriority(task.priority || 'medium');
    setFormStatus(task.status || 'pending');
    setFormDueDate(task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : '');
    setFormAssignedTo(task.assignedTo?._id || task.assignedTo || '');
    setIsEditModalOpen(true);
  };

  // Open Details Modal
  const openDetailsModal = (task) => {
    setActiveTask(task);
    setIsDetailsModalOpen(true);
  };

  // Open Delete Confirmation
  const openDeleteModal = (task) => {
    setActiveTask(task);
    setIsDeleteModalOpen(true);
  };

  // Handle Create Task Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showAlert('Task title is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        priority: formPriority,
        dueDate: formDueDate || null,
        assignedTo: formAssignedTo || null,
      };

      const res = await taskService.createTask(payload);
      setTasks((prev) => [res.data.task, ...prev]);
      setIsCreateModalOpen(false);
      showAlert('Task created successfully!');
    } catch (err) {
      showAlert(err.message || 'Failed to create task', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Edit Task Submit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showAlert('Task title is required', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        priority: formPriority,
        status: formStatus,
        dueDate: formDueDate || null,
        assignedTo: formAssignedTo || null,
      };

      const res = await taskService.updateTask(activeTask._id, payload);
      setTasks((prev) =>
        prev.map((t) => (t._id === activeTask._id ? res.data.task : t))
      );
      setIsEditModalOpen(false);
      showAlert('Task updated successfully!');
    } catch (err) {
      showAlert(err.message || 'Failed to update task', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Delete Task Confirm
  const handleDeleteConfirm = async () => {
    if (!activeTask) return;

    setIsSubmitting(true);
    try {
      await taskService.deleteTask(activeTask._id);
      setTasks((prev) => prev.filter((t) => t._id !== activeTask._id));
      setIsDeleteModalOpen(false);
      showAlert('Task deleted successfully.');
    } catch (err) {
      showAlert(err.message || 'Failed to delete task', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status button advance for direct click
  const handleAdvanceStatus = async (task) => {
    const sequence = [
      TASK_STATUS.PENDING,
      TASK_STATUS.IN_PROGRESS,
      TASK_STATUS.COMPLETED,
    ];
    const currentIndex = sequence.indexOf(task.status);
    const nextStatus = sequence[(currentIndex + 1) % sequence.length];

    if (!canChangeStatus(task)) {
      showAlert('You are not authorized to update progress on this task.', 'error');
      return;
    }

    const previousTasks = [...tasks];
    setTasks((prev) =>
      prev.map((t) => (t._id === task._id ? { ...t, status: nextStatus } : t))
    );

    try {
      await taskService.updateTaskStatus(task._id, nextStatus);
      showAlert(`Task marked as ${STATUS_CONFIG[nextStatus]?.label}!`);
    } catch (err) {
      setTasks(previousTasks);
      showAlert(err.message || 'Failed to update task status', 'error');
    }
  };

  // Filter tasks in memory for real-time responsiveness
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Search query
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchesTitle = t.title?.toLowerCase().includes(q);
        const matchesDesc = t.description?.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc) return false;
      }
      // Status filter
      if (statusFilter !== 'all' && t.status !== statusFilter) {
        return false;
      }
      // Priority filter
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) {
        return false;
      }
      return true;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const isOverdue = (task) => {
    if (!task?.dueDate || task.status === TASK_STATUS.COMPLETED) return false;
    return new Date(task.dueDate) < new Date();
  };

  return (
    <div className="space-y-6">
      {/* Alert Notification Toast */}
      {alertInfo && (
        <div
          className={`p-3.5 rounded-xl text-sm flex items-center justify-between gap-3 shadow-lg transition-all animate-in fade-in slide-in-from-top-2 ${
            alertInfo.type === 'error'
              ? 'bg-rose-500/15 border border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {alertInfo.type === 'error' ? (
              <AlertCircle className="w-5 h-5 shrink-0 text-rose-400" />
            ) : (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            )}
            <span>{alertInfo.message}</span>
          </div>
          <button
            onClick={() => setAlertInfo(null)}
            className="p-1 text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header & Primary Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <Layers className="w-6 h-6 text-indigo-400" />
            Task Management System
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Drag and drop tasks across workflow columns or switch to list view.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('board')}
              title="Kanban Board View"
              className={`p-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'board'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Kanban className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              title="Table List View"
              className={`p-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Create Task Button (Authorized roles only) */}
          {canCreate && (
            <Button
              onClick={openCreateModal}
              className="flex items-center gap-2 py-2.5 px-4 text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Create Task
            </Button>
          )}
        </div>
      </div>

      {/* Search and Filtering Toolbar */}
      <div className="glass-card rounded-xl p-4 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks by title or description..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        {/* Filter dropdowns */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in-progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 hidden sm:inline">Priority:</span>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          {(search || statusFilter !== 'all' || priorityFilter !== 'all') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
              className="text-xs text-slate-400 hover:text-indigo-400 underline underline-offset-4 cursor-pointer"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area: Kanban Board or List View */}
      {loading ? (
        <LoadingSpinner size="lg" className="py-20" />
      ) : filteredTasks.length === 0 && tasks.length === 0 ? (
        <div className="glass-card rounded-2xl p-12 text-center border border-slate-800">
          <Layers className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-slate-200">No tasks in this workspace</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {canCreate
              ? 'Get started by creating your team’s first task with the button above.'
              : 'You do not have any assigned tasks yet.'}
          </p>
        </div>
      ) : viewMode === 'board' ? (
        /* KANBAN BOARD VIEW */
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {KANBAN_COLUMNS.map((col) => {
            const columnTasks = filteredTasks.filter((t) => t.status === col.id);
            const ColIcon = col.icon;
            const isTarget = dragOverColumn === col.id;

            return (
              <div
                key={col.id}
                onDragOver={(e) => handleDragOver(e, col.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, col.id)}
                className={`flex flex-col rounded-2xl bg-slate-900/40 border transition-all duration-200 min-h-[500px] ${
                  isTarget
                    ? 'border-indigo-500 bg-indigo-950/20 shadow-xl shadow-indigo-500/10 scale-[1.01]'
                    : 'border-slate-800/80 hover:border-slate-700'
                }`}
              >
                {/* Column Header */}
                <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ColIcon className={`w-4 h-4 ${col.color}`} />
                    <h3 className="font-semibold text-sm text-white tracking-wide">
                      {col.title}
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {columnTasks.length}
                  </span>
                </div>

                {/* Column Drop Area & Task Cards */}
                <div className="p-3 space-y-3 flex-1">
                  {columnTasks.length === 0 ? (
                    <div className="h-32 rounded-xl border border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-600">
                      Drag tasks here
                    </div>
                  ) : (
                    columnTasks.map((task) => {
                      const overdue = isOverdue(task);

                      return (
                        <div
                          key={task._id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, task._id)}
                          className="glass-card rounded-xl p-4 border border-slate-800/90 shadow-md hover:border-slate-700 transition-all cursor-grab active:cursor-grabbing hover:shadow-lg group"
                        >
                          {/* Card top badges */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <PriorityBadge priority={task.priority} />
                            {overdue && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                <AlertTriangle className="w-3 h-3" />
                                Overdue
                              </span>
                            )}
                          </div>

                          {/* Card Title */}
                          <h4
                            onClick={() => openDetailsModal(task)}
                            className="font-semibold text-sm text-white hover:text-indigo-300 transition-colors cursor-pointer line-clamp-2 mb-1.5"
                          >
                            {task.title}
                          </h4>

                          {/* Description snippet */}
                          {task.description && (
                            <p className="text-xs text-slate-400 line-clamp-2 mb-3">
                              {task.description}
                            </p>
                          )}

                          {/* Footer with Assignee & Due Date */}
                          <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                            {/* Assignee */}
                            <div className="flex items-center gap-1.5">
                              {task.assignedTo ? (
                                <div
                                  title={`Assigned to: ${task.assignedTo.name}`}
                                  className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white shadow"
                                >
                                  {getInitials(task.assignedTo.name)}
                                </div>
                              ) : (
                                <span className="text-slate-600 italic">Unassigned</span>
                              )}
                              <span className="truncate max-w-[100px] text-slate-300">
                                {task.assignedTo?.name || ''}
                              </span>
                            </div>

                            {/* Due Date */}
                            {task.dueDate && (
                              <span
                                className={`flex items-center gap-1 ${
                                  overdue ? 'text-rose-400 font-medium' : 'text-slate-500'
                                }`}
                              >
                                <Calendar className="w-3 h-3" />
                                {formatDate(task.dueDate)}
                              </span>
                            )}
                          </div>

                          {/* Card Action Overlay on Hover */}
                          <div className="mt-3 pt-2 border-t border-slate-800/40 flex items-center justify-between">
                            <button
                              onClick={() => openDetailsModal(task)}
                              title="View Task Details"
                              className="text-xs text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5 text-indigo-400" />
                              Details
                            </button>

                            <div className="flex items-center gap-1">
                              {canEdit(task) && (
                                <button
                                  onClick={() => openEditModal(task)}
                                  title="Edit Task"
                                  className="p-1 rounded text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete(task) && (
                                <button
                                  onClick={() => openDeleteModal(task)}
                                  title="Delete Task"
                                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canChangeStatus(task) && (
                                <button
                                  onClick={() => handleAdvanceStatus(task)}
                                  title="Advance Status"
                                  className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* TABLE LIST VIEW */
        <div className="glass-card rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900/80 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="px-6 py-4">Task Title</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Priority</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">Due Date</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="py-12 text-center text-slate-500 text-sm">
                      No tasks matching the selected filters or search query.
                    </td>
                  </tr>
                ) : (
                  filteredTasks.map((task) => (
                    <tr key={task._id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-6 py-4">
                        <div
                          onClick={() => openDetailsModal(task)}
                          className="font-medium text-white hover:text-indigo-300 cursor-pointer transition-colors"
                        >
                          {task.title}
                        </div>
                      {task.description && (
                        <div className="text-xs text-slate-500 truncate max-w-sm">
                          {task.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={task.status} />
                    </td>
                    <td className="px-6 py-4">
                      <PriorityBadge priority={task.priority} />
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {task.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-[10px] font-bold text-white">
                            {getInitials(task.assignedTo.name)}
                          </div>
                          <span>{task.assignedTo.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs">
                      {task.dueDate ? (
                        <span className={isOverdue(task) ? 'text-rose-400 font-semibold' : 'text-slate-400'}>
                          {formatDate(task.dueDate)}
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openDetailsModal(task)}
                          title="View Details"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-300 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {canEdit(task) && (
                          <button
                            onClick={() => openEditModal(task)}
                            title="Edit Task"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {canDelete(task) && (
                          <button
                            onClick={() => openDeleteModal(task)}
                            title="Delete Task"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card rounded-2xl w-full max-w-lg p-6 border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Create New Task</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Implement Role-Based Access Guards"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Specify task requirements and success criteria..."
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Assign To
                  </label>
                  <select
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {assignableUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formDueDate}
                  onChange={(e) => setFormDueDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsCreateModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  Create Task
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT TASK MODAL */}
      {isEditModalOpen && activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card rounded-2xl w-full max-w-lg p-6 border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">Edit Task</h2>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                  Description
                </label>
                <textarea
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Status
                  </label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="pending">Pending</option>
                    <option value="in-progress">In Progress</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Priority
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Assign To
                  </label>
                  <select
                    value={formAssignedTo}
                    onChange={(e) => setFormAssignedTo(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">Unassigned</option>
                    {assignableUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={formDueDate}
                    onChange={(e) => setFormDueDate(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsEditModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" isLoading={isSubmitting}>
                  Save Changes
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAILS MODAL */}
      {isDetailsModalOpen && activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card rounded-2xl w-full max-w-lg p-6 border border-slate-700 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <StatusBadge status={activeTask.status} />
                <PriorityBadge priority={activeTask.priority} />
              </div>
              <button
                onClick={() => setIsDetailsModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-xl font-bold text-white mb-2">{activeTask.title}</h2>
            <p className="text-sm text-slate-300 whitespace-pre-wrap mb-6 bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
              {activeTask.description || 'No detailed description provided.'}
            </p>

            <div className="grid grid-cols-2 gap-4 text-xs bg-slate-900/40 p-4 rounded-xl border border-slate-800/80 mb-6">
              <div>
                <span className="text-slate-500 block mb-1 uppercase font-semibold">
                  Assigned User:
                </span>
                <span className="text-white font-medium">
                  {activeTask.assignedTo?.name || 'Unassigned'}
                </span>
                {activeTask.assignedTo?.email && (
                  <span className="text-slate-500 block text-[11px]">
                    {activeTask.assignedTo.email}
                  </span>
                )}
              </div>

              <div>
                <span className="text-slate-500 block mb-1 uppercase font-semibold">
                  Created By:
                </span>
                <span className="text-white font-medium">
                  {activeTask.createdBy?.name || 'System'}
                </span>
                {activeTask.createdBy?.role && (
                  <div className="mt-0.5">
                    <RoleBadge role={activeTask.createdBy.role} />
                  </div>
                )}
              </div>

              <div>
                <span className="text-slate-500 block mb-1 uppercase font-semibold">
                  Due Date:
                </span>
                <span
                  className={
                    isOverdue(activeTask) ? 'text-rose-400 font-semibold' : 'text-slate-300'
                  }
                >
                  {formatDate(activeTask.dueDate)}
                </span>
              </div>

              <div>
                <span className="text-slate-500 block mb-1 uppercase font-semibold">
                  Created At:
                </span>
                <span className="text-slate-300">{formatDate(activeTask.createdAt)}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              {canEdit(activeTask) && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    openEditModal(activeTask);
                  }}
                >
                  Edit Task
                </Button>
              )}
              <Button onClick={() => setIsDetailsModalOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {isDeleteModalOpen && activeTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-card rounded-2xl w-full max-w-md p-6 border border-rose-500/30 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center gap-3 text-rose-400 mb-3">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="text-lg font-bold text-white">Delete Task Confirmation</h3>
            </div>
            <p className="text-sm text-slate-300 mb-6">
              Are you sure you want to permanently delete task{' '}
              <strong className="text-white">&quot;{activeTask.title}&quot;</strong>? This action
              cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setIsDeleteModalOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                isLoading={isSubmitting}
              >
                Delete Permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TasksPage;
