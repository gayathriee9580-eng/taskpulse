import React from 'react';
import { STATUS_CONFIG, PRIORITY_CONFIG, TASK_STATUS, TASK_PRIORITY } from '../../utils/constants.js';

export const RoleBadge = ({ role }) => {
  const roleStyles = {
    admin: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    manager: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    user: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  };

  const style = roleStyles[role] || roleStyles.user;

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border capitalize ${style}`}
    >
      {role || 'user'}
    </span>
  );
};

export const StatusBadge = ({ status }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG[TASK_STATUS.PENDING];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${config.color}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
};

export const PriorityBadge = ({ priority }) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG[TASK_PRIORITY.MEDIUM];

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border capitalize ${config.color}`}
    >
      {config.label}
    </span>
  );
};

export default {
  RoleBadge,
  StatusBadge,
  PriorityBadge,
};
