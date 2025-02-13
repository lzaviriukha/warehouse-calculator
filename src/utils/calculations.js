// src/utils/calculations.js

/**
 * Parses time from a string in the format "HH:MM AM/PM" or "HH:MM".
 * Returns an object { hours, minutes } in 24-hour format.
 */
export const parseTime = (timeStr) => {
  if (!timeStr) return { hours: 0, minutes: 0 };
  if (!timeStr.includes(' ')) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }
  const [time, modifier] = timeStr.split(' ');
  let [hours, minutes] = time.split(':').map(Number);
  if (modifier.toUpperCase() === 'PM' && hours < 12) hours += 12;
  if (modifier.toUpperCase() === 'AM' && hours === 12) hours = 0;
  return { hours, minutes };
};

/**
 * Calculates deviations, required speed, and other parameters for the shift.
 * Если базовая норма заказов за час (baseRequiredSpeed) превышает возможности обработки в последний час
 * (capacityLastHour = staffForLastPeriod * avgPackingSpeed), то избыток распределяется равномерно
 * на оставшиеся часы до последнего (T - 1), и требуемая скорость (requiredSpeed) увеличивается.
 *
 * @param {object} settings - Shift settings:
 *   shiftStart, shiftEnd, breaks, expectedOrders, avgPackingSpeed, avgPickingSpeed, staffForLastPeriod
 * @param {number} pickedActual - Actual orders picked.
 * @param {number} packedActual - Actual orders packed.
 * @returns {object} Calculation results.
 */
export const calculateDeviations = (settings, pickedActual, packedActual) => {
  const now = new Date();
  if (!settings.shiftStart || !settings.shiftEnd) {
    return {
      packingDeviation: 0,
      pickingDeviation: 0,
      hoursPassed: 0,
      expectedProcessed: 0,
      requiredSpeed: 0,
      totalWorkTime: 0,
    };
  }
  
  // Parse shift start/end times.
  const { hours: startHour, minutes: startMinute } = parseTime(settings.shiftStart);
  const { hours: endHour, minutes: endMinute } = parseTime(settings.shiftEnd);
  const shiftStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
  const shiftEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
  const totalShiftHours = (shiftEndDate - shiftStartDate) / (1000 * 60 * 60);
  
  // Total break hours.
  let totalBreakHours = 0;
  if (Array.isArray(settings.breaks)) {
    settings.breaks.forEach(brk => {
      if (brk.start && brk.end) {
        const { hours: bStartHour, minutes: bStartMinute } = parseTime(brk.start);
        const { hours: bEndHour, minutes: bEndMinute } = parseTime(brk.end);
        const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
        const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
        totalBreakHours += (breakEnd - breakStart) / (1000 * 60 * 60);
      }
    });
  } else if (typeof settings.breaks === 'string' && settings.breaks.trim() !== '') {
    const breakIntervals = settings.breaks.split(',').map(s => s.trim());
    breakIntervals.forEach(interval => {
      const [start, end] = interval.split('-').map(s => s.trim());
      const { hours: bStartHour, minutes: bStartMinute } = parseTime(start);
      const { hours: bEndHour, minutes: bEndMinute } = parseTime(end);
      const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
      const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
      totalBreakHours += (breakEnd - breakStart) / (1000 * 60 * 60);
    });
  }
  
  const totalWorkTime = totalShiftHours - totalBreakHours;
  
  // Raw hours passed since shift start.
  let rawHoursPassed = 0;
  if (now > shiftStartDate) {
    rawHoursPassed = (now - shiftStartDate) / (1000 * 60 * 60);
    if (rawHoursPassed > totalShiftHours) rawHoursPassed = totalShiftHours;
  }
  
  // Break time passed so far.
  let breakTimePassed = 0;
  if (Array.isArray(settings.breaks)) {
    settings.breaks.forEach(brk => {
      if (brk.start && brk.end) {
        const { hours: bStartHour, minutes: bStartMinute } = parseTime(brk.start);
        const { hours: bEndHour, minutes: bEndMinute } = parseTime(brk.end);
        const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
        const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
        if (now >= breakEnd) {
          breakTimePassed += (breakEnd - breakStart) / (1000 * 60 * 60);
        } else if (now > breakStart && now < breakEnd) {
          breakTimePassed += (now - breakStart) / (1000 * 60 * 60);
        }
      }
    });
  }
  
  const effectiveHoursPassed = rawHoursPassed - breakTimePassed;
  
  // Base required speed for the shift (orders per hour).
  const R = Number(settings.expectedOrders);
  const baseRequiredSpeed = R / totalWorkTime;
  
  // Base expected processed orders so far.
  const baseExpectedProcessed = baseRequiredSpeed * effectiveHoursPassed;
  
  // Remaining orders and remaining time until end of shift.
  const remainingOrders = R - baseExpectedProcessed;
  const remainingTime = totalWorkTime - effectiveHoursPassed;
  
  // Calculate capacity in the last hour.
  const staffLastHour = Number(settings.staffForLastPeriod) || 0;
  const avgPack = Number(settings.avgPackingSpeed) || 0;
  const capacityLastHour = staffLastHour * avgPack;
  
  // Мы хотим, чтобы к началу последнего часа (то есть, за T-1 часов) оставшиеся заказы были равны capacityLastHour.
  // Поэтому кандидат для требуемой скорости:
  let candidateSpeed = baseRequiredSpeed;
  if (totalWorkTime > 1) {
    candidateSpeed = (R - capacityLastHour) / (totalWorkTime - 1);
  }
  const newRequiredSpeed = Math.max(baseRequiredSpeed, candidateSpeed);
  
  const requiredSpeed = newRequiredSpeed;
  const newExpectedProcessed = requiredSpeed * effectiveHoursPassed;
  
  const packingDeviation = Number(packedActual) - newExpectedProcessed;
  const pickingDeviation = Number(pickedActual) - newExpectedProcessed;
  
  return {
    packingDeviation,
    pickingDeviation,
    hoursPassed: effectiveHoursPassed,
    expectedProcessed: newExpectedProcessed,
    requiredSpeed,
    totalWorkTime,
  };
};

/**
 * Calculates the expected number of orders processed by a given control point,
 * using the same adjusted required speed as for the entire shift.
 *
 * @param {object} settings - Shift settings.
 * @param {string} controlTime - Control point time in "HH:MM" or "HH:MM AM/PM" format.
 * @returns {number} Expected processed orders by that control point.
 */
export const calculateExpectedAtTime = (settings, controlTime) => {
  if (!controlTime || !settings.shiftStart || !settings.shiftEnd) return 0;
  
  // Рассчитываем эффективное время от начала смены до контрольной точки.
  const now = new Date();
  const { hours: startHour, minutes: startMinute } = parseTime(settings.shiftStart);
  const shiftStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
  const { hours: cpHour, minutes: cpMinute } = parseTime(controlTime);
  const cpDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), cpHour, cpMinute);
  
  let rawHours = (cpDate - shiftStartDate) / (1000 * 60 * 60);
  if (rawHours < 0) rawHours = 0;
  
  let breakBefore = 0;
  if (Array.isArray(settings.breaks)) {
    settings.breaks.forEach(brk => {
      if (brk.start && brk.end) {
        const { hours: bStartHour, minutes: bStartMinute } = parseTime(brk.start);
        const { hours: bEndHour, minutes: bEndMinute } = parseTime(brk.end);
        const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
        const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
        if (breakEnd <= cpDate) {
          breakBefore += (breakEnd - breakStart) / (1000 * 60 * 60);
        } else if (breakStart < cpDate && breakEnd > cpDate) {
          breakBefore += (cpDate - breakStart) / (1000 * 60 * 60);
        }
      }
    });
  }
  
  const effectiveHours = Math.max(rawHours - breakBefore, 0);
  
  // Рассчитываем требуемую скорость для всей смены так же, как в calculateDeviations
  const { hours: endHour, minutes: endMinute } = parseTime(settings.shiftEnd);
  const shiftEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
  const totalShiftHours = (shiftEndDate - shiftStartDate) / (1000 * 60 * 60);
  
  let totalBreakHours = 0;
  if (Array.isArray(settings.breaks)) {
    settings.breaks.forEach(brk => {
      if (brk.start && brk.end) {
        const { hours: bStartHour, minutes: bStartMinute } = parseTime(brk.start);
        const { hours: bEndHour, minutes: bEndMinute } = parseTime(brk.end);
        const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
        const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
        totalBreakHours += (breakEnd - breakStart) / (1000 * 60 * 60);
      }
    });
  }
  
  const totalWorkTime = totalShiftHours - totalBreakHours;
  const R = Number(settings.expectedOrders);
  const baseSpeed = R / totalWorkTime;
  
  // Расчет кандидата для новой скорости так, как в calculateDeviations.
  const staffLastHour = Number(settings.staffForLastPeriod) || 0;
  const avgPack = Number(settings.avgPackingSpeed) || 0;
  const capacityLastHour = staffLastHour * avgPack;
  let candidateSpeed = baseSpeed;
  if (totalWorkTime > 1) {
    candidateSpeed = (R - capacityLastHour) / (totalWorkTime - 1);
  }
  const newSpeed = Math.max(baseSpeed, candidateSpeed);
  
  const expectedAtCP = newSpeed * effectiveHours;
  return expectedAtCP;
};

/**
 * Generates staffing recommendations based on deviations.
 *
 * @param {object} deviations - Object with deviations (packingDeviation, pickingDeviation).
 * @param {object} settings - Shift settings (must include avgPackingSpeed and avgPickingSpeed).
 * @param {object} lastHourIndicators - (Optional) Additional indicators for the last hour.
 * @returns {object} An object with recommendations for packing and picking.
 */
export const calculateRecommendations = (deviations, settings, lastHourIndicators = null) => {
  let packingRec = '';
  let pickingRec = '';
  
  const individualPackingSpeed = Number(settings.avgPackingSpeed) || 0;
  const individualPickingSpeed = Number(settings.avgPickingSpeed) || 0;
  
  if (deviations.packingDeviation < 0) {
    const additionalEmployees = Math.abs(deviations.packingDeviation) / individualPackingSpeed;
    packingRec = `To meet the packing plan, add ${additionalEmployees.toFixed(2)} employees.`;
  } else if (deviations.packingDeviation > 0) {
    const employeesToRemove = deviations.packingDeviation / individualPackingSpeed;
    packingRec = `You can remove ${employeesToRemove.toFixed(2)} employees from packing.`;
  } else {
    packingRec = "The packing plan is met exactly.";
  }
  
  if (deviations.pickingDeviation < 0) {
    const additionalEmployees = Math.abs(deviations.pickingDeviation) / individualPickingSpeed;
    pickingRec = `To meet the picking plan, add ${additionalEmployees.toFixed(2)} employees.`;
  } else if (deviations.pickingDeviation > 0) {
    const employeesToRemove = deviations.pickingDeviation / individualPickingSpeed;
    pickingRec = `You can remove ${employeesToRemove.toFixed(2)} employees from picking.`;
  } else {
    pickingRec = "The picking plan is met exactly.";
  }
  
  if (lastHourIndicators) {
    packingRec += ` Additionally, for the last hour, add ${lastHourIndicators.staffNeededPacking.toFixed(2)} employees.`;
    pickingRec += ` Additionally, for the last hour, add ${lastHourIndicators.staffNeededPicking.toFixed(2)} employees.`;
  }
  
  return { packing: packingRec, picking: pickingRec };
};

/**
 * Calculates indicators for the last hour of work.
 * Здесь рассчитываем ожидаемое количество заказов, обработанных к началу последнего часа,
 * и затем оставшиеся заказы, которые должны быть обработаны за последний час.
 * Эти оставшиеся заказы делятся на соответствующую среднюю скорость, чтобы определить,
 * сколько сотрудников дополнительно потребуется.
 *
 * @param {object} settings - Shift settings.
 * @returns {object} An object with last hour indicators:
 *   - expectedOrdersLastHour: expected orders in the last hour,
 *   - staffNeededPacking: required additional staff for packing in the last hour,
 *   - staffNeededPicking: required additional staff for picking in the last hour.
 */
export const calculateLastHourIndicators = (settings) => {
  if (!settings.shiftStart || !settings.shiftEnd || !settings.expectedOrders) {
    return { expectedOrdersLastHour: 0, staffNeededPacking: 0, staffNeededPicking: 0 };
  }
  
  const now = new Date();
  const { hours: startHour, minutes: startMinute } = parseTime(settings.shiftStart);
  const { hours: endHour, minutes: endMinute } = parseTime(settings.shiftEnd);
  const shiftStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
  const shiftEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
  
  const totalShiftHours = (shiftEndDate - shiftStartDate) / (1000 * 60 * 60);
  
  // Total break hours.
  let totalBreakHours = 0;
  if (Array.isArray(settings.breaks)) {
    totalBreakHours = settings.breaks.reduce((acc, brk) => {
      if (brk.start && brk.end) {
        const { hours: bStartHour, minutes: bStartMinute } = parseTime(brk.start);
        const { hours: bEndHour, minutes: bEndMinute } = parseTime(brk.end);
        const breakStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bStartHour, bStartMinute);
        const breakEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), bEndHour, bEndMinute);
        return acc + (breakEnd - breakStart) / (1000 * 60 * 60);
      }
      return acc;
    }, 0);
  }
  
  const totalWorkTime = totalShiftHours - totalBreakHours;
  const R = Number(settings.expectedOrders);
  const baseRequiredSpeed = R / totalWorkTime; // базовая скорость (orders/hour)
  
  // Для контрольных точек мы хотим использовать ту же скорректированную скорость,
  // как и в calculateDeviations. В данном случае, рассчитываем candidateSpeed:
  const staffLastHour = Number(settings.staffForLastPeriod) || 0;
  const avgPack = Number(settings.avgPackingSpeed) || 0;
  const capacityLastHour = staffLastHour * avgPack;
  let candidateSpeed = baseRequiredSpeed;
  if (totalWorkTime > 1) {
    candidateSpeed = (R - capacityLastHour) / (totalWorkTime - 1);
  }
  const newRequiredSpeed = Math.max(baseRequiredSpeed, candidateSpeed);
  
  // Ожидаемые обработанные заказы к началу последнего часа (за T - 1 часов)
  const processedBeforeLastHour = newRequiredSpeed * (totalWorkTime - 1);
  const remainingOrdersLastHour = R - processedBeforeLastHour;
  
  const expectedOrdersLastHour = remainingOrdersLastHour;
  
  const avgPickingSpeed = Number(settings.avgPickingSpeed) || 0;
  
  const staffNeededPacking = avgPack > 0 ? expectedOrdersLastHour / avgPack : 0;
  const staffNeededPicking = avgPickingSpeed > 0 ? expectedOrdersLastHour / avgPickingSpeed : 0;
  
  return { expectedOrdersLastHour, staffNeededPacking, staffNeededPicking };
};
