import { getJSON, setJSON, removeKey } from "./storage.js";

const USERS_KEY = "users";
const CURRENT_USER_KEY = "current_user";

function normalizeValue(value) {
  return value.trim().toLowerCase();
}

function normalizeUsername(username) {
  return normalizeValue(username);
}

async function hashPassword(password) {
  if (window.crypto && window.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));

    return hashArray
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return `fallback:${btoa(password)}`;
}

function removePasswordHash(user) {
  if (!user) {
    return null;
  }

  const { passwordHash, emailNormalized, ...safeUser } = user;
  return safeUser;
}

function findUserByUsernameOrEmail(users, identifier) {
  const cleanIdentifier = normalizeValue(identifier);

  if (users[cleanIdentifier]) {
    return users[cleanIdentifier];
  }

  const foundEntry = Object.values(users).find((user) => {
    const email = normalizeValue(user.email || "");
    const username = normalizeValue(user.username || "");

    return email === cleanIdentifier || username === cleanIdentifier;
  });

  return foundEntry || null;
}

export const AuthService = {
  async register({ name, email, username, password }) {
    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const emailNormalized = normalizeValue(email);
    const cleanUsername = normalizeUsername(username);

    if (!cleanName || !cleanEmail || !cleanUsername || !password) {
      throw new Error("Semua field wajib diisi.");
    }

    if (password.length < 4) {
      throw new Error("Password minimal 4 karakter.");
    }

    const users = getJSON(USERS_KEY, {});

    if (users[cleanUsername]) {
      throw new Error("Username sudah digunakan.");
    }

    const emailAlreadyUsed = Object.values(users).some((user) => {
      return normalizeValue(user.email || "") === emailNormalized;
    });

    if (emailAlreadyUsed) {
      throw new Error("Email sudah digunakan.");
    }

    const passwordHash = await hashPassword(password);

    users[cleanUsername] = {
      name: cleanName,
      email: cleanEmail,
      emailNormalized,
      username: cleanUsername,
      passwordHash,
      createdAt: new Date().toISOString()
    };

    setJSON(USERS_KEY, users);
    setJSON(CURRENT_USER_KEY, cleanUsername);

    return removePasswordHash(users[cleanUsername]);
  },

  async login(identifier, password) {
    const users = getJSON(USERS_KEY, {});
    const user = findUserByUsernameOrEmail(users, identifier);

    if (!user) {
      throw new Error("Email atau username tidak ditemukan.");
    }

    const passwordHash = await hashPassword(password);

    if (user.passwordHash !== passwordHash) {
      throw new Error("Password salah.");
    }

    setJSON(CURRENT_USER_KEY, user.username);

    return removePasswordHash(user);
  },

  logout() {
    removeKey(CURRENT_USER_KEY);
  },

  getCurrentUser() {
    const username = getJSON(CURRENT_USER_KEY, null);

    if (!username) {
      return null;
    }

    const users = getJSON(USERS_KEY, {});
    const user = users[username];

    if (!user) {
      removeKey(CURRENT_USER_KEY);
      return null;
    }

    return removePasswordHash(user);
  },

  updateProfile({ name, email }) {
    const currentUser = this.getCurrentUser();

    if (!currentUser) {
      throw new Error("User belum login.");
    }

    const users = getJSON(USERS_KEY, {});
    const emailNormalized = normalizeValue(email);

    const emailAlreadyUsed = Object.values(users).some((user) => {
      return (
        user.username !== currentUser.username &&
        normalizeValue(user.email || "") === emailNormalized
      );
    });

    if (emailAlreadyUsed) {
      throw new Error("Email sudah digunakan oleh akun lain.");
    }

    users[currentUser.username] = {
      ...users[currentUser.username],
      name: name.trim(),
      email: email.trim(),
      emailNormalized
    };

    setJSON(USERS_KEY, users);

    return removePasswordHash(users[currentUser.username]);
  }
};