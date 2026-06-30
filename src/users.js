// RBAC: usuarios, roles y permisos. Store en data/users.json.
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import config from './config.js';
import store from './store.js';

// Catálogo de permisos (20).
export const PERMISSIONS = [
  'view_home', 'view_chat', 'send_chat',
  'view_agents', 'manage_gateway', 'manage_agents',
  'view_skills', 'manage_skills',
  'view_cron', 'manage_cron',
  'view_mcp', 'manage_mcp',
  'view_files', 'edit_files',
  'view_usage', 'view_logs', 'view_monitor',
  'view_office', 'manage_office',
  'use_terminal', 'manage_maintenance', 'manage_users',
];

const VIEWER_PERMS = PERMISSIONS.filter((p) => p.startsWith('view_'));

// Permisos efectivos de un usuario según su rol.
export function effectivePerms(user) {
  if (!user) return [];
  if (user.role === 'admin') return [...PERMISSIONS];
  if (user.role === 'viewer') return [...VIEWER_PERMS, 'view_office', 'view_monitor'];
  return user.permissions || [];
}

export function hasPerm(user, perm) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  return effectivePerms(user).includes(perm);
}

// ¿Puede el usuario ver/gestionar este perfil de agente?
export function canAccessProfile(user, profile) {
  if (!user || user.role === 'admin') return true;
  const allowed = user.allowed_profiles || ['*'];
  return allowed.includes('*') || allowed.includes(profile);
}

function load() {
  let users = store.read('users', null);
  if (!users || !users.length) {
    // Sembrar admin por defecto con la contraseña del .env
    users = [{
      id: 'u-admin',
      username: 'admin',
      passwordHash: bcrypt.hashSync(config.password, 10),
      role: 'admin',
      permissions: [],
      allowed_profiles: ['*'],
      createdAt: new Date().toISOString(),
    }];
    store.write('users', users);
  }
  return users;
}

export function listUsers() {
  return load().map(({ passwordHash, ...u }) => u);
}

export function findByUsername(username) {
  return load().find((u) => u.username === username);
}

export function findById(id) {
  return load().find((u) => u.id === id);
}

export function authenticate(username, password) {
  const u = findByUsername(username || 'admin');
  if (!u) return null;
  if (!bcrypt.compareSync(password || '', u.passwordHash)) return null;
  return u;
}

export function createUser({ username, password, role = 'custom', permissions = [], allowed_profiles = ['*'] }) {
  if (!username || !password) throw new Error('usuario y contraseña obligatorios');
  const users = load();
  if (users.some((u) => u.username === username)) throw new Error('ese usuario ya existe');
  const user = {
    id: 'u-' + crypto.randomBytes(4).toString('hex'),
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    role,
    permissions,
    allowed_profiles,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  store.write('users', users);
  const { passwordHash, ...safe } = user;
  return safe;
}

export function updateUser(id, patch) {
  const users = load();
  const u = users.find((x) => x.id === id);
  if (!u) throw new Error('usuario no encontrado');
  if (patch.password) u.passwordHash = bcrypt.hashSync(patch.password, 10);
  if (patch.role) u.role = patch.role;
  if (patch.permissions) u.permissions = patch.permissions;
  if (patch.allowed_profiles) u.allowed_profiles = patch.allowed_profiles;
  store.write('users', users);
  const { passwordHash, ...safe } = u;
  return safe;
}

export function deleteUser(id) {
  let users = load();
  const u = users.find((x) => x.id === id);
  if (!u) throw new Error('usuario no encontrado');
  if (u.username === 'admin') throw new Error('no se puede borrar al admin principal');
  users = users.filter((x) => x.id !== id);
  store.write('users', users);
  return { ok: true };
}

export default {
  PERMISSIONS, effectivePerms, hasPerm, canAccessProfile,
  listUsers, findByUsername, findById, authenticate, createUser, updateUser, deleteUser,
};
