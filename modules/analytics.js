// analytics.js - compute summary statistics and datasets for charts
import { state, computeLotSuccess } from './storage.js';

/**
 * Compute general summary metrics for dashboard and analytics.
 */
export function computeSummary() {
  const totalVarieties = state.varieties.length;
  const totalCustomers = state.customers.length;
  const totalLots = state.lots.length;
  const totalOrders = state.orders.length;
  // Total revenue = sum of order totals
  let totalRevenue = 0;
  state.orders.forEach(order => {
    totalRevenue += order.total || 0;
  });
  // Average lot success rate
  let successSum = 0;
  state.lots.forEach(lot => {
    successSum += computeLotSuccess(lot);
  });
  const avgSuccess = totalLots > 0 ? Math.round((successSum / totalLots) * 100) / 100 : 0;
  return {
    totalVarieties,
    totalCustomers,
    totalLots,
    totalOrders,
    totalRevenue,
    avgSuccess
  };
}

/**
 * Compute orders count and revenue aggregated by month.
 * Returns an object {labels: ["YYYY-MM"], orders: [], revenue: []}
 */
export function computeOrdersByMonth() {
  const map = {};
  state.orders.forEach(order => {
    const date = order.date || order.createdAt;
    if (!date) return;
    const month = date.slice(0, 7); // YYYY-MM
    if (!map[month]) {
      map[month] = { orders: 0, revenue: 0 };
    }
    map[month].orders += 1;
    map[month].revenue += order.total || 0;
  });
  const labels = Object.keys(map).sort();
  return {
    labels,
    orders: labels.map(m => map[m].orders),
    revenue: labels.map(m => Math.round(map[m].revenue * 100) / 100)
  };
}

/**
 * Compute top varieties by quantity sold.
 * Returns an array of {name, quantity} sorted descending.
 */
export function computeTopVarieties(limit = 5) {
  const countMap = {};
  state.orders.forEach(order => {
    (order.items || []).forEach(item => {
      const varId = item.varietyId;
      if (!countMap[varId]) countMap[varId] = 0;
      countMap[varId] += parseFloat(item.quantity) || 0;
    });
  });
  // Map to names
  const nameMap = {};
  state.varieties.forEach(v => nameMap[v.id] = v.name);
  const arr = Object.keys(countMap).map(varId => ({
    id: varId,
    name: nameMap[varId] || varId,
    quantity: countMap[varId]
  }));
  arr.sort((a, b) => b.quantity - a.quantity);
  return arr.slice(0, limit);
}

/**
 * Compute average success rate per propagation method.
 * Returns an object {labels: [], success: []}
 */
export function computeSuccessByMethod() {
  const map = {};
  state.lots.forEach(lot => {
    const method = lot.method || 'Unknown';
    if (!map[method]) map[method] = { sum: 0, count: 0 };
    map[method].sum += computeLotSuccess(lot);
    map[method].count += 1;
  });
  const labels = Object.keys(map);
  const success = labels.map(m => {
    const entry = map[m];
    const avg = entry.count ? Math.round((entry.sum / entry.count) * 100) / 100 : 0;
    return avg;
  });
  return { labels, success };
}