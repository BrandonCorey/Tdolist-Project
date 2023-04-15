const { Client } = require('pg');
const dbQuery = require('./db-query');

class PgPersistence {
  constructor(session) {
    // this._todoLists = session.todoLists || deepCopy(SeedData);
    // session.todoLists = this._todoLists;
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

  async sortedTodos(todoList) {
    const SORTED_TODOS = (
    `SELECT * 
    FROM todos 
    WHERE todolist_id = $1 
    ORDER BY done, LOWER(title)`);

    let result = await dbQuery(SORTED_TODOS, todoList.id)
    let todos = result.rows;
    console.log(todos)

    return todos;
  }

  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  hasUndoneTodos(todoList) {
    return todoList.todos.length > 0 && !this.isDoneTodoList(todoList)
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

  setTodoListTitle(todoListId, title) {
    // let todoList = this._findTodoList(todoListId);
    // if (!todoList) return false;
    
    // todoList.title = title;
    // return true;
  }

  existsTodoListTitle(title) {
    // return this._todoLists.some(todoList => todoList.title === title);
  }

  deleteTodoList(todoListId) {
    // let todoListIdx = this._todoLists.findIndex(todoList => todoList.id === todoListId);
    // if (todoListIdx === 1) return false;

    // this._todoLists.splice(todoListIdx, 1);
    // return true;
  }

  loadTodo(todoListId, todoId) {
    // let todo = this._findTodo(todoListId, todoId);
    // return deepCopy(todo);
  }

  toggleTodo(todoListId, todoId) {
    // let todo = this._findTodo(todoListId, todoId)
    // if (!todo) return false;
    
    // todo.done = !todo.done
    // return true;
  }

  deleteTodo(todoListId, todoId) {
    // let todoList = this._findTodoList(todoListId);
    // if (!todoList) return false;

    // let todoIdx = todoList.todos.findIndex(todo => todo.id === todoId);
    // if (todoIdx === -1) return false;
    
    // todoList.todos.splice(todoIdx, 1);
    // return true;
  }

  addTodo(todoListId, todoTitle) {
    // let todoList = this._findTodoList(todoListId)
    
    // if (!todoList) return false;
    // todoList.todos.push({
    //   id: nextId(),
    //   title: todoTitle,
    //   done: false
    // });

    // return true;
  }

  completeAllTodos(todoListId) {
    // let todoList = this._findTodoList(todoListId);

    // if (!todoList) return false;
    // let undone = todoList.todos.filter(todo => !todo.done);
    // undone.forEach(todo => {
    //   todo.done = true;
    // });

    // return true;
  }

  _findTodoList (todoListId) {
    // return this._todoLists.find(todoList => todoList.id === todoListId)
  }

  _findTodo(todoListId, todoId) {
    // let todoList = this._findTodoList(todoListId);
    
    // if (!todoList) return undefined;
    // return todoList.todos.find(todo => todo.id === todoId);
  }
}

module.exports = PgPersistence;