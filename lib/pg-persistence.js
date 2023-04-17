const { Client } = require('pg');
const dbQuery = require('./db-query');
const bcrypt = require('bcrypt');

class PgPersistence {
  constructor(session) {
    this.username = session.username;
  }

  async addTodo(todoListId, todoTitle) {
    const ADD_TODO = `INSERT INTO todos
                        (todolist_id, title, username)
                          VALUES
                            ($1, $2, $3)`;

    let result = await dbQuery(ADD_TODO, todoListId, todoTitle, this.username);
    return result.rowCount > 0;
  }

  async authenticateUser(username, password) {
    const FIND_HASHED_PASSWORD = `SELECT password
                                  FROM users
                                  WHERE username = $1`;

    let result = await dbQuery(FIND_HASHED_PASSWORD, username);
    console.log(result)
    if (result.rowCount === 0) return false;

    return bcrypt.compare(password, result.rows[0].password)
  } 

  async completeAllTodos(todoListId) {
    const COMPLETE_ALL = `UPDATE todos
                          SET done = true
                          WHERE todolist_id = $1
                            AND username = $2`;

    let result = await dbQuery(COMPLETE_ALL, todoListId, this.username);
    return result.rowCount > 0;
  }

  async createTodoList(todoListId) {
    const CREATE_TODOLIST = `INSERT INTO todolists
                               (title, username) 
                               VALUES
                                 ($1, $2)`;

    try {
      let result = await dbQuery(CREATE_TODOLIST, todoListId, this.username);
      return result.rowCount > 0;
    } catch (error) {
      if (this.isUniqueConstraintViolation(error)) return false;
      throw error;
    }
  }

  async deleteTodo(todoListId, todoId) {
    const DELETE_TODO = `DELETE FROM todos
                         WHERE todolist_id = $1
                           AND id = $2
                           AND username = $3`;

    let result = await dbQuery(DELETE_TODO, todoListId, todoId, this.username);
    return result.rowCount > 0;
  }

  async deleteTodoList(todoListId) {
    const DELETE_TODOLIST = `DELETE FROM todolists
                             WHERE id = $1
                               AND username = $2`;

    let result = await dbQuery(DELETE_TODOLIST, todoListId, this.username);
    return result.rowCount > 0;
  }

  async existsTodoListTitle(title) {
    const TODO_LISTS = `SELECT *
                        FROM todolists
                        WHERE title = $1
                          AND username = $2`;

    let result = await dbQuery(TODO_LISTS, title, this.username);
    return result.rowCount > 0;
  }


  hasUndoneTodos(todoList) {
    return todoList.todos.length > 0 && !this.isDoneTodoList(todoList)
  }

  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  isUniqueConstraintViolation(error) {
    return /duplicate key value violates unique constraint/.test(String(error));
  }

  async loadTodo(todoListId, todoId) {
    const FIND_TODO = `SELECT *
                       FROM todos
                       WHERE todolist_id = $1
                         AND id = $2
                         AND username = $3`;

    let result = await dbQuery(FIND_TODO , todoListId, todoId, this.username);
    let todo = result.rows[0];

    return todo;
  }

  async loadTodoList(todoListId) {
    const FIND_TODOLIST = `SELECT *
                           FROM todolists
                           WHERE id = $1
                             AND username = $2`;

    const FIND_TODOS = `SELECT *
                        FROM todos
                        WHERE todolist_id = $1
                          AND username = $2`;

    let resultTodoList = dbQuery(FIND_TODOLIST, todoListId, this.username);
    let resultTodos = dbQuery(FIND_TODOS, todoListId, this.username);
    let resultBoth = await Promise.all([resultTodoList, resultTodos]);

    let todoList = resultBoth[0].rows[0];
    if (!todoList) return undefined;

    todoList.todos = resultBoth[1].rows;
    return todoList;
  }

  async setTodoListTitle(todoListId, title) {
    const SET_TODOLIST_TITLE = `UPDATE todolists
                                SET title = $2
                                WHERE id = $1
                                  AND username = $3`;

    let result = await dbQuery(SET_TODOLIST_TITLE, todoListId, title, this.username);
    return result.rowCount > 0;
  }

  async sortedTodos(todoList) {
    const SORTED_TODOS = `SELECT * 
                          FROM todos 
                          WHERE todolist_id = $1
                            AND username = $2
                          ORDER BY done, LOWER(title)`;

    let result = await dbQuery(SORTED_TODOS, todoList.id, this.username);
    let todos = result.rows;

    return todos;
  }

  async sortedTodoLists() {
    const ALL_TODOLISTS = `SELECT *
                           FROM todolists
                           WHERE username = $1
                           ORDER BY lower(title) ASC`;

    const ALL_TODOS = `SELECT *
                        FROM todos
                        WHERE username = $1`;

    let resultTodoLists = dbQuery(ALL_TODOLISTS, this.username);
    let resultTodos = dbQuery(ALL_TODOS, this.username);
    let resultBoth = await Promise.all([resultTodoLists, resultTodos]);

    let allTodoLists = resultBoth[0].rows;
    let allTodos = resultBoth[1].rows;

    if (!allTodoLists || !allTodos) return undefined;

    console.log(allTodos)

    allTodoLists.forEach(todoList => {
      todoList.todos = allTodos.filter(todo => {
        return todoList.id === todo.todolist_id;
      });
    });

    return this._partitionTodoLists(allTodoLists);
  }

  async toggleTodo(todoListId, todoId) {
    const TOGGLE_TODO = `UPDATE todos
                            SET done = NOT done
                            WHERE todolist_id = $1
                              AND id = $2
                              AND username = $3`

    let result = await dbQuery(TOGGLE_TODO, todoListId, todoId, this.username);
    return result.rowCount > 0;
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