import { getJSON, setJSON } from "./storage.js";

function getOldTaskKey(username) {
  return `tasks_${username}`;
}

function getTaskListKey(username) {
  return `task_lists_${username}`;
}

function getActiveTaskListKey(username) {
  return `active_task_list_${username}`;
}

function createId(prefix = "id") {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function ensureTaskLists(username) {
  const existingLists = getJSON(getTaskListKey(username), null);

  if (Array.isArray(existingLists) && existingLists.length > 0) {
    return existingLists;
  }

  const oldTasks = getJSON(getOldTaskKey(username), []);

  const defaultList = {
    id: createId("list"),
    name: "Utama",
    createdAt: new Date().toISOString(),
    tasks: Array.isArray(oldTasks) ? oldTasks : []
  };

  const lists = [defaultList];

  setJSON(getTaskListKey(username), lists);
  setJSON(getActiveTaskListKey(username), defaultList.id);

  return lists;
}

function saveTaskLists(username, lists) {
  setJSON(getTaskListKey(username), lists);
}

export const TodoService = {
  getLists(username) {
    return ensureTaskLists(username);
  },

  getActiveListId(username) {
    const lists = ensureTaskLists(username);
    const activeId = getJSON(getActiveTaskListKey(username), null);
    const activeListExists = lists.some((list) => list.id === activeId);

    if (activeListExists) {
      return activeId;
    }

    const firstListId = lists[0].id;
    setJSON(getActiveTaskListKey(username), firstListId);

    return firstListId;
  },

  setActiveListId(username, listId) {
    const lists = ensureTaskLists(username);
    const listExists = lists.some((list) => list.id === listId);

    if (!listExists) {
      return;
    }

    setJSON(getActiveTaskListKey(username), listId);
  },

  addList(username, name) {
    const cleanName = name.trim();

    if (!cleanName) {
      throw new Error("Nama task list tidak boleh kosong.");
    }

    const lists = ensureTaskLists(username);

    const duplicateName = lists.some((list) => {
      return list.name.trim().toLowerCase() === cleanName.toLowerCase();
    });

    if (duplicateName) {
      throw new Error("Nama task list sudah ada.");
    }

    const newList = {
      id: createId("list"),
      name: cleanName,
      createdAt: new Date().toISOString(),
      tasks: []
    };

    lists.push(newList);
    saveTaskLists(username, lists);
    setJSON(getActiveTaskListKey(username), newList.id);

    return newList;
  },

  getAll(username) {
    const lists = ensureTaskLists(username);
    const activeListId = this.getActiveListId(username);
    const activeList = lists.find((list) => list.id === activeListId);

    return activeList ? activeList.tasks : [];
  },

  add(username, name) {
    const cleanName = name.trim();

    if (!cleanName) {
      throw new Error("Nama kegiatan tidak boleh kosong.");
    }

    const lists = ensureTaskLists(username);
    const activeListId = this.getActiveListId(username);

    const newTask = {
      id: createId("task"),
      name: cleanName,
      completed: false,
      createdAt: new Date().toISOString()
    };

    const nextLists = lists.map((list) => {
      if (list.id !== activeListId) {
        return list;
      }

      return {
        ...list,
        tasks: [newTask, ...list.tasks]
      };
    });

    saveTaskLists(username, nextLists);

    return newTask;
  },

  toggle(username, taskId) {
    const lists = ensureTaskLists(username);
    const activeListId = this.getActiveListId(username);

    const nextLists = lists.map((list) => {
      if (list.id !== activeListId) {
        return list;
      }

      return {
        ...list,
        tasks: list.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          return {
            ...task,
            completed: !task.completed
          };
        })
      };
    });

    saveTaskLists(username, nextLists);

    return this.getAll(username);
  },

  remove(username, taskId) {
    const lists = ensureTaskLists(username);
    const activeListId = this.getActiveListId(username);

    const nextLists = lists.map((list) => {
      if (list.id !== activeListId) {
        return list;
      }

      return {
        ...list,
        tasks: list.tasks.filter((task) => task.id !== taskId)
      };
    });

    saveTaskLists(username, nextLists);

    return this.getAll(username);
  }
};