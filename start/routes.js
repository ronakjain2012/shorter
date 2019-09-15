'use strict'

/*
|--------------------------------------------------------------------------
| Routes
|--------------------------------------------------------------------------
|
| Http routes are entry points to your web application. You can create
| routes for different URL's and bind Controller actions to them.
|
| A complete guide on routing is available here.
| http://adonisjs.com/guides/routing
|
*/

const Route = use('Route')
/**
 * Website API Routes
 */
Route.post('app/short','IndexController.store')
Route.get('app/short/:id','IndexController.find')
Route.post('app/visit','VisitLogController.update')
Route.post('app/session','SessionController.store')


Route.any('*', 'NuxtController.render')
