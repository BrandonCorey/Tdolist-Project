const { Client } = require('pg');
const dbQuery = require('./db-query');
const bcrypt = require('bcrypt');

class PgPersistence {
  async authenticateUser(username, password) {
    const FIND_HASHED_PASSWORD = `SELECT password
                                  FROM users
                                  WHERE username = $1`;

    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password)
  } 

  async createTodoList(todoListId) {
    const CREATE_TODOLIST = `INSERT INTO todolists (title) VALUES ($1)`;

    try {
      let result = await dbQuery(CREATE_TODOLIST, todoListId);
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  async loadTodoList(todoListId) {
    const FIND_TODOLIST = 'SELECT * FROM todolists WHERE id = $1';
    const FIND_TODOS = 'SELECT * FROM todos WHERE todolist_id = $1';

    let resultTodoList = dbQuery(FIND_TODOLIST, todoListId);
    let resultTodos = dbQuery(FIND_TODOS, todoListId);
    let resultBoth = await Promise.all([resultTodoList, resultTodos]);

    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;

    todoList.todos = resultBoth[1].rows;
    return todoList;
  }

  async setTodoListTitle(todoListId, title) {
    const SET_TODOLIST_TITLE = `UPDATE todolists
                                SET title = $2
                                WHERE id = $1`

    let result = await dbQuery(SET_TODOLIST_TITLE, todoListId, title);
    return result.rowCount > 0;
  }

  async deleteTodoList(todoListId) {
    const DELETE_TODOLIST = `DELETE FROM todolists
                             WHERE id = $1`;

    let result = await dbQuery(DELETE_TODOLIST, todoListId);
    return result.rowCount > 0;
  }

  async existsTodoListTitle(title) {
    const TODO_LISTS = `SELECT * FROM todolists WHERE title = $1`;

    let result = await dbQuery(TODO_LISTS, title);
    return result.rowCount > 0;
  }

  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  hasUndoneTodos(todoList) {
    return todoList.todos.length > 0 && !this.isDoneTodoList(todoList)
  }

  async sortedTodoLists() {
    const ALL_TODOLISTS = 'SELECT * FROM todolists ORDER BY lower(title) ASC';
    const FIND_TODOS = 'SELECT * FROM todos WHERE todolist_id = $1';

    let resultTodoLists = await dbQuery(ALL_TODOLISTS);
    let todoLists = resultTodoLists.rows;

    for (let idx = 0; idx < todoLists.length; idx++) {
      let todoList = todoLists[idx];
      let resultTodos = await dbQuery(FIND_TODOS, todoList.id);
      let todos = resultTodos.rows;
    
      todoList.todos = todos;
    }

    return this._partitionTodoLists(todoLists);
  }

  async addTodo(todoListId, todoTitle) {
    const ADD_TODO = `INSERT INTO todos
                        (todolist_id, title)
                        VALUES ($1, $2)`;

    let result = await dbQuery(ADD_TODO, todoListId, todoTitle);
    return result.rowCount > 0;
  }

  async loadTodo(todoListId, todoId) {
    const FIND_TODO = `SELECT *
                       FROM todos
                       WHERE todolist_id = $1
                         AND id = $2`;

    let result = await dbQuery(FIND_TODO , todoListId, todoId);
    let todo = result.rows[0];

    return todo;
  }

  async toggleTodo(todoListId, todoId) {
    const TOGGLE_TODO = `UPDATE todos
                            SET done = NOT done
                            WHERE todolist_id = $1
                              AND id = $2`

    let result = await dbQuery(TOGGLE_TODO, todoListId, todoId);
    return result.rowCount > 0;
  }

  async deleteTodo(todoListId, todoId) {
    const DELETE_TODO = `DELETE FROM todos
                         WHERE todolist_id = $1
                           AND id = $2`;

    let result = await dbQuery(DELETE_TODO, todoListId, todoId);
    return result.rowCount > 0;
  }

  async completeAllTodos(todoListId) {
    const COMPLETE_ALL = `UPDATE todos
                          SET done = true
                          WHERE todolist_id = $1`;

    let result = await dbQuery(COMPLETE_ALL, todoListId);
    return result.rowCount > 0;
  }

  async sortedTodos(todoList) {
    const SORTED_TODOS = (
    `SELECT * 
    FROM todos 
    WHERE todolist_id = $1 
    ORDER BY done, LOWER(title)`);

    let result = await dbQuery(SORTED_TODOS, todoList.id)
    let todos = result.rows;

    return todos;
  }

  // Returns `true` if `error` seems to indicate a `UNIQUE` constraint
  // violation, `false` otherwise.
  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  _partitionTodoLists(todoLists) {
    let done = [];
    let undone = [];

    todoLists.forEach(todoList => {
      if (this.isDoneTodoList(todoList)) done.push(todoList);
      else undone.push(todoList);
    });

    return undone.concat(done);
  }
}

module.exports = PgPersistence;