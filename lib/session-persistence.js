const SeedData = require('./seed-data');
const deepCopy = require('./deep-copy');
const { sortTodoLists, sortTodos } = require('./sort');
const nextId = require('./next-id');

// The whole point of this class is to provide an API to manipulate req.session.todoLists
 
// Check if session.todoLists already exists an has data
// If not, create a deepcopy of our seed data and store its reference in _todotodoLists
// Then, update session.todoLists in case it didn't have data in it before or didn't exist
class SessionPersistence {
  constructor(session) {
    this._todoLists = session.todoLists || deepCopy(SeedData);
    session.todoLists = this._todoLists;
  }

  sortedTodoLists() {
    let todoLists = deepCopy(this._todoLists);
    let undone = todoLists.filter(todoList => !this.isDoneTodoList(todoList));
    let done = todoLists.filter(todoList => this.isDoneTodoList(todoList));
    return sortTodoLists(undone, done);
  }

  isDoneTodoList(todoList) {
    return todoList.todos.length > 0 && todoList.todos.every(todo => todo.done);
  }

  loadTodoList(todoListId) {
    let todoList = this._findTodoList(todoListId);
    return deepCopy(todoList);
  }

  setTodoListTitle(todoListId, title) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;
    
    todoList.title = title;
    return true;
  }

  existsTodoListTitle(title) {
    console.log(this._todoLists)
    return this._todoLists.some(todoList => todoList.title === title);
  }

  deleteTodoList(todoListId) {
    let todoListIdx = this._todoLists.findIndex(todoList => todoList.id === todoListId);
    if (todoListIdx === 1) return false;

    this._todoLists.splice(todoListIdx, 1);
    return true;
  }

  loadTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId);
    return deepCopy(todo);
  }

  toggleTodo(todoListId, todoId) {
    let todo = this._findTodo(todoListId, todoId)
    if (!todo) return false;
    
    todo.done = !todo.done
    return true;
  }

  deleteTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    if (!todoList) return false;

    let todoIdx = todoList.todos.findIndex(todo => todo.id === todoId);
    if (todoIdx === -1) return false;
    
    todoList.todos.splice(todoIdx, 1);
    return true;
  }

  addTodo(todoListId, todoTitle) {
    let todoList = this._findTodoList(todoListId)
    
    if (!todoList) return false;
    todoList.todos.push({
      id: nextId(),
      title: todoTitle,
      done: false
    });

    return true;
  }

  completeAllTodos(todoListId) {
    let todoList = this._findTodoList(todoListId);

    if (!todoList) return false;
    let undone = todoList.todos.filter(todo => !todo.done);
    undone.forEach(todo => {
      todo.done = true;
    });

    return true;
  }

  _findTodoList (todoListId) {
    return this._todoLists.find(todoList => todoList.id === todoListId)
  }

  _findTodo(todoListId, todoId) {
    let todoList = this._findTodoList(todoListId);
    
    if (!todoList) return undefined;
    return todoList.todos.find(todo => todo.id === todoId);
  }

  sortedTodos(todoList) {
    let todos = deepCopy(todoList.todos);
    let done = todos.filter(todos => todos.done);
    let undone = todos.filter(todos => !todos.done);

    return sortTodos(undone, done);
  }

  hasUndoneTodos(todoList) {
    return todoList.todos.length > 0 && !this.isDoneTodoList(todoList)
  }
}

module.exports = SessionPersistence;