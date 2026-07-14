export const APPLICATION_ROLES = {
    SUPER_ADMIN: "super_admin",
    CLIENT_ADMIN: "client_admin",
    CLIENT_VIEWER: "client_viewer"
};

export const ROLES = [
    APPLICATION_ROLES.SUPER_ADMIN,
    APPLICATION_ROLES.CLIENT_ADMIN,
    APPLICATION_ROLES.CLIENT_VIEWER
];

export const CLIENT_ROLES = [
    APPLICATION_ROLES.CLIENT_ADMIN,
    APPLICATION_ROLES.CLIENT_VIEWER
];

export const isValidClientRole = (role) =>
    CLIENT_ROLES.includes(role);

export const isValidRole = (role) =>
    ROLES.includes(role);