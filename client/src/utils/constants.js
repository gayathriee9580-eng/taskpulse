export const USER_ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  USER: 'user',
};

export const TASK_STATUS = {
  PENDING: 'pending',
  IN_PROGRESS: 'in-progress',
  COMPLETED: 'completed',
};

export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
};

export const STATUS_CONFIG = {
  [TASK_STATUS.PENDING]: {
    id: 'pending',
    label: 'Pending',
    color: 'bg-amber-950/40 text-amber-300 border-amber-800/50',
    dot: 'bg-amber-400',
    headerBg: 'from-amber-500/10 to-transparent',
    border: 'border-amber-500/20',
  },
  [TASK_STATUS.IN_PROGRESS]: {
    id: 'in-progress',
    label: 'In Progress',
    color: 'bg-indigo-950/40 text-indigo-300 border-indigo-800/50',
    dot: 'bg-indigo-400',
    headerBg: 'from-indigo-500/10 to-transparent',
    border: 'border-indigo-500/20',
  },
  [TASK_STATUS.COMPLETED]: {
    id: 'completed',
    label: 'Completed',
    color: 'bg-emerald-950/40 text-emerald-300 border-emerald-800/50',
    dot: 'bg-emerald-400',
    headerBg: 'from-emerald-500/10 to-transparent',
    border: 'border-emerald-500/20',
  },
};

export const PRIORITY_CONFIG = {
  [TASK_PRIORITY.LOW]: {
    label: 'Low',
    color: 'bg-slate-800/80 text-slate-300 border-slate-700/80',
    badge: 'text-slate-400',
  },
  [TASK_PRIORITY.MEDIUM]: {
    label: 'Medium',
    color: 'bg-sky-950/50 text-sky-300 border-sky-800/50',
    badge: 'text-sky-400',
  },
  [TASK_PRIORITY.HIGH]: {
    label: 'High',
    color: 'bg-rose-950/50 text-rose-300 border-rose-800/50',
    badge: 'text-rose-400',
  },
};
