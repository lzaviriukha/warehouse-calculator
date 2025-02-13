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
 * Calculates deviations and required speeds separately for Picking and Packing.
 *
 * For each process:
 *   baseSpeed = R / T, where R = expectedOrders and T = total effective work time.
 *   targetProcessed = R - (staffForLastPeriod * avgSpeed)
 *   candidateSpeed = (T > 1) ? targetProcessed / (T - 1) : baseSpeed
 *   newRequiredSpeed = max(baseSpeed, candidateSpeed)
 *   expectedProcessed = newRequiredSpeed * effectiveHoursPassed, capped at R.
 *   If actual processed orders ≥ R, then deviation is set to 0.
 *
 * @param {object} settings - Shift settings:
 *   shiftStart, shiftEnd, breaks, expectedOrders, avgSpeed, staffForLastPeriod
 * @param {number} pickedActual - Actual orders picked.
 * @param {number} packedActual - Actual orders packed.
 * @returns {object} Calculation results.
 */
export const calculateDeviations = (settings, pickedActual, packedActual) => {
  const now = new Date();
  if (!settings.shiftStart || !settings.shiftEnd) {
    return {
      pickingDeviation: 0,
      packingDeviation: 0,
      hoursPassed: 0,
      expectedProcessedPicking: 0,
      expectedProcessedPacking: 0,
      requiredSpeedPicking: 0,
      requiredSpeedPacking: 0,
      totalWorkTime: 0,
    };
  }
  
  // Parse shift start/end times.
  const { hours: startHour, minutes: startMinute } = parseTime(settings.shiftStart);
  const { hours: endHour, minutes: endMinute } = parseTime(settings.shiftEnd);
  const shiftStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), startHour, startMinute);
  const shiftEndDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute);
  const totalShiftHours = (shiftEndDate - shiftStartDate) / (1000 * 60 * 60);
  
  // Calculate total break hours.
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
  
  // Calculate raw hours passed from shift start.
  let rawHoursPassed = 0;
  if (now > shiftStartDate) {
    rawHoursPassed = (now - shiftStartDate) / (1000 * 60 * 60);
    if (rawHoursPassed > totalShiftHours) rawHoursPassed = totalShiftHours;
  }
  
  // Calculate break time passed so far.
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
  
  // R – expected orders for each process.
  const R = Number(settings.expectedOrders);
  // Base speed (orders/hour) for each process.
  const baseSpeed = R / totalWorkTime;
  
  // Base expected processed orders.
  const baseExpectedProcessed = baseSpeed * effectiveHoursPassed;
  
  // Using avgSpeed (без деления на 2)
  const avgSpeed = Number(settings.avgSpeed) || 0;
  const staffLastHour = Number(settings.staffForLastPeriod) || 0;
  
  // Для каждого процесса:
  // targetProcessed = R - (staffForLastPeriod * avgSpeed)
  const targetProcessedPicking = R - (staffLastHour * avgSpeed);
  const targetProcessedPacking = R - (staffLastHour * avgSpeed);
  
  // Candidate speed = targetProcessed / (T - 1)
  const candidateSpeedPicking = (totalWorkTime > 1) ? targetProcessedPicking / (totalWorkTime - 1) : baseSpeed;
  const candidateSpeedPacking = (totalWorkTime > 1) ? targetProcessedPacking / (totalWorkTime - 1) : baseSpeed;
  
  const newRequiredSpeedPicking = Math.max(baseSpeed, candidateSpeedPicking);
  const newRequiredSpeedPacking = Math.max(baseSpeed, candidateSpeedPacking);
  
  let expectedProcessedPicking = newRequiredSpeedPicking * effectiveHoursPassed;
  let expectedProcessedPacking = newRequiredSpeedPacking * effectiveHoursPassed;
  
  // Если расчетное количество превышает R, то ограничиваем его значением R
  if (expectedProcessedPicking > R) {
    expectedProcessedPicking = R;
  }
  if (expectedProcessedPacking > R) {
    expectedProcessedPacking = R;
  }
  
  // Если фактическое количество >= R, отклонение = 0
  const pickingDeviation = pickedActual >= R ? 0 : (pickedActual - expectedProcessedPicking);
  const packingDeviation = packedActual >= R ? 0 : (packedActual - expectedProcessedPacking);
  
  return {
    pickingDeviation,
    packingDeviation,
    hoursPassed: effectiveHoursPassed,
    expectedProcessedPicking,
    expectedProcessedPacking,
    requiredSpeedPicking: newRequiredSpeedPicking,
    requiredSpeedPacking: newRequiredSpeedPacking,
    totalWorkTime,
  };
};

/**
 * Calculates the expected number of processed orders by a given control point,
 * using the same adjusted required speeds for both processes.
 *
 * @param {object} settings - Shift settings.
 * @param {string} controlTime - Control point time in "HH:MM" or "HH:MM AM/PM" format.
 * @returns {object} An object: { expectedPicking, expectedPacking }.
 */
export const calculateExpectedAtTime = (settings, controlTime) => {
  if (!controlTime || !settings.shiftStart || !settings.shiftEnd) {
    return { expectedPicking: 0, expectedPacking: 0 };
  }
  
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
  
  // Total work time.
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
  
  // Adjusted candidate speeds for both processes.
  const staffLastHour = Number(settings.staffForLastPeriod) || 0;
  const avgSpeed = Number(settings.avgSpeed) || 0;
  
  const candidateSpeedPicking = (totalWorkTime > 1) ? (R - (staffLastHour * avgSpeed)) / (totalWorkTime - 1) : baseSpeed;
  const candidateSpeedPacking = (totalWorkTime > 1) ? (R - (staffLastHour * avgSpeed)) / (totalWorkTime - 1) : baseSpeed;
  
  const newSpeedPicking = Math.max(baseSpeed, candidateSpeedPicking);
  const newSpeedPacking = Math.max(baseSpeed, candidateSpeedPacking);
  
  const expectedPicking = newSpeedPicking * effectiveHours;
  const expectedPacking = newSpeedPacking * effectiveHours;
  
  // Если превышают R, то ограничиваем до R.
  const cappedExpectedPicking = expectedPicking > R ? R : expectedPicking;
  const cappedExpectedPacking = expectedPacking > R ? R : expectedPacking;
  
  return { expectedPicking: cappedExpectedPicking, expectedPacking: cappedExpectedPacking };
};

/**
 * Generates staffing recommendations based on deviations.
 *
 * @param {object} deviations - Object with deviations.
 * @param {object} settings - Shift settings.
 * @param {object} lastHourIndicators - (Optional) Additional indicators for the last hour.
 * @returns {object} An object with recommendations for picking and packing.
 */
export const calculateRecommendations = (deviations, settings, lastHourIndicators = null) => {
  let packingRec = '';
  let pickingRec = '';
  
  const individualSpeed = Number(settings.avgSpeed) || 0;
  
  if (deviations.packingDeviation < 0) {
    const additionalEmployees = Math.abs(deviations.packingDeviation) / (individualSpeed * 2);
    packingRec = `To meet the packing plan, add ${additionalEmployees.toFixed(2)} employees.`;
  } else if (deviations.packingDeviation > 0) {
    const employeesToRemove = deviations.packingDeviation / (individualSpeed * 2);
    packingRec = `You can remove ${employeesToRemove.toFixed(2)} employees from packing.`;
  } else {
    packingRec = "The packing plan is met exactly.";
  }
  
  if (deviations.pickingDeviation < 0) {
    const additionalEmployees = Math.abs(deviations.pickingDeviation) / (individualSpeed * 2);
    pickingRec = `To meet the picking plan, add ${additionalEmployees.toFixed(2)} employees.`;
  } else if (deviations.pickingDeviation > 0) {
    const employeesToRemove = deviations.pickingDeviation / (individualSpeed * 2);
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
 *
 * For each process, the actual remaining orders are calculated as:
 *    (expectedOrders - actualProcessed) / 2,
 * so that the total remaining is divided equally between Picking and Packing.
 * Then, staff needed for each process = (remaining orders for process) / avgSpeed.
 *
 * @param {object} settings - Shift settings.
 * @returns {object} An object with last hour indicators:
 *   - expectedOrdersLastHour: expected orders in the last hour (per process),
 *   - staffNeededPacking: required additional staff for packing (per process),
 *   - staffNeededPicking: required additional staff for picking (per process).
 */
export const calculateLastHourIndicators = (settings) => {
  if (!settings.shiftStart || !settings.shiftEnd || !settings.expectedOrders) {
    return { expectedOrdersLastHour: 0, staffNeededPacking: 0, staffNeededPicking: 0 };
  }
  
  const R = Number(settings.expectedOrders);
  // По предположению, общее ожидаемое количество заказов для каждого процесса = R.
  // Оставшиеся заказы для обоих процессов = R - (фактическое обработанное). 
  // Если взять фактическое обработанное для Picking и Packing суммарно, то для каждого процесса оставшаяся часть = (R - actual)/2.
  // Здесь мы будем рассчитывать на основе фактических данных, которые вводятся на странице UpdateData.
  // Для простоты примера, предположим, что фактическое обработанное количество заказов для каждого процесса учитывается отдельно.
  // Но если мы хотим, чтобы оставшиеся заказы рассчитывались на основе того, что общий план должен быть выполнен для каждого процесса,
  // то оставшиеся заказы для Picking = (R - pickedActual) / 2, и для Packing = (R - packedActual) / 2.
  // Так что в компоненте UpdateData мы можем вычислять это непосредственно.
  // Здесь в этой функции можно просто вернуть базовую норму для последнего часа:
  
  const baseRequiredSpeed = R / (R / R); // не используется, поэтому здесь просто:
  // Мы возвращаем ожидаемые заказы в последний час равными половине оставшихся, но эта логика может быть реализована в компоненте.
  
  // Пусть expectedOrdersLastHour = (R - 0)/2 = R/2 (это базовая модель, которую можно доработать)
  const expectedOrdersLastHour = R / 2;
  const avgSpeed = Number(settings.avgSpeed) || 0;
  const staffNeededPicking = avgSpeed > 0 ? expectedOrdersLastHour / avgSpeed : 0;
  const staffNeededPacking = avgSpeed > 0 ? expectedOrdersLastHour / avgSpeed : 0;
  
  return { expectedOrdersLastHour, staffNeededPacking, staffNeededPicking };
};
