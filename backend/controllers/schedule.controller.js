const schedule = require('../services/schedule.service');

async function dashboard(request, response, next) {
  try { return response.json(await schedule.dashboard(request.user.sub, request.query.date)); }
  catch (error) { return next(error); }
}

async function create(request, response, next) {
  try { return response.status(201).json(await schedule.createAppointment(request.user.sub, request.body)); }
  catch (error) { return next(error); }
}

async function updateStatus(request, response, next) {
  try { return response.json(await schedule.updateAppointmentStatus(request.user.sub, request.params.id, request.body.status)); }
  catch (error) { return next(error); }
}

async function clients(request, response, next) {
  try { return response.json(await schedule.listClients(request.user.sub, request.query.q)); }
  catch (error) { return next(error); }
}

async function createClient(request, response, next) {
  try { return response.status(201).json(await schedule.createClient(request.user.sub, request.body)); }
  catch (error) { return next(error); }
}

async function services(request, response, next) {
  try { return response.json(await schedule.listServices(request.user.sub)); }
  catch (error) { return next(error); }
}

async function createService(request, response, next) {
  try { return response.status(201).json(await schedule.createService(request.user.sub, request.body)); }
  catch (error) { return next(error); }
}

async function updateService(request, response, next) {
  try { return response.json(await schedule.updateService(request.user.sub, request.params.id, request.body)); }
  catch (error) { return next(error); }
}

async function professionals(request, response, next) {
  try { return response.json(await schedule.listProfessionals(request.user.sub)); }
  catch (error) { return next(error); }
}

async function createProfessional(request, response, next) {
  try { return response.status(201).json(await schedule.createProfessional(request.user.sub, request.body)); }
  catch (error) { return next(error); }
}

async function updateProfessional(request, response, next) {
  try { return response.json(await schedule.updateProfessional(request.user.sub, request.params.id, request.body)); }
  catch (error) { return next(error); }
}

async function reservations(request, response, next) {
  try { return response.json(await schedule.listReservations(request.user.sub)); }
  catch (error) { return next(error); }
}

async function coupons(request, response, next) {
  try { return response.json(await schedule.listCoupons(request.user.sub)); }
  catch (error) { return next(error); }
}

async function createCoupon(request, response, next) {
  try { return response.status(201).json(await schedule.createCoupon(request.user.sub, request.body)); }
  catch (error) { return next(error); }
}

async function updateCoupon(request, response, next) {
  try { return response.json(await schedule.updateCoupon(request.user.sub, request.params.id, request.body)); }
  catch (error) { return next(error); }
}

async function deleteCoupon(request, response, next) {
  try { await schedule.deleteCoupon(request.user.sub, request.params.id); return response.status(204).end(); }
  catch (error) { return next(error); }
}

async function paymentSettings(request, response, next) {
  try { return response.json(await schedule.getPaymentSettings(request.user.sub)); }
  catch (error) { return next(error); }
}

async function updatePaymentSettings(request, response, next) {
  try { return response.json(await schedule.updatePaymentSettings(request.user.sub, request.body)); }
  catch (error) { return next(error); }
}

async function hoursSettings(request, response, next) {
  try { return response.json(await schedule.getHoursSettings(request.user.sub)); }
  catch (error) { return next(error); }
}

async function updateHoursSettings(request, response, next) {
  try { return response.json(await schedule.updateHoursSettings(request.user.sub, request.body)); }
  catch (error) { return next(error); }
}

module.exports = { dashboard, create, updateStatus, clients, createClient, services, createService, updateService, professionals, createProfessional, updateProfessional, reservations, coupons, createCoupon, updateCoupon, deleteCoupon, paymentSettings, updatePaymentSettings, hoursSettings, updateHoursSettings };
