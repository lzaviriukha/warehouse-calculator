// src/components/UpdateData/UpdateData.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import Container from '../Container';
import Button from '../Button';
import Input from '../Input';
import {
  calculateDeviations,
  calculateRecommendations,
  calculateExpectedAtTime,
} from '../../utils/calculations';
import { motion } from 'framer-motion';
import styled from 'styled-components';

// --- Styled Components ---
const FormContainer = styled.div`
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  margin-top: 20px;
`;

const FormField = styled.div`
  flex: 1;
  min-width: 280px;
  display: flex;
  flex-direction: column;
`;

const Label = styled.label`
  font-size: 14px;
  margin-bottom: 8px;
  font-weight: 500;
  color: #555;
`;

const ResultsContainer = styled.div`
  margin-top: 30px;
  padding: 20px;
  background: #f9f9fb;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
`;

const SectionTitle = styled.h3`
  margin-top: 20px;
  margin-bottom: 10px;
  color: #007aff;
`;

const ProgressBarContainer = styled.div`
  background: #e0e0e0;
  border-radius: 10px;
  overflow: hidden;
  margin-top: 20px;
  height: 20px;
`;

const ProgressBar = styled(motion.div)`
  background: linear-gradient(90deg, #007aff, #0051a8);
  height: 100%;
  width: ${props => props.width}%;
`;

const ControlPointContainer = styled.div`
  margin-top: 30px;
`;

const CPBlock = styled.div`
  margin-bottom: 15px;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
`;

const SmallButton = styled.button`
  padding: 6px 12px;
  background: #f0f0f0;
  border: 1px solid #ccc;
  border-radius: 6px;
  color: #333;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s ease;
  &:hover {
    background: #e0e0e0;
  }
  margin-top: 10px;
`;

// Компонент для условного отображения статуса
const StatusText = styled.span`
  color: ${props => (props.positive ? 'green' : props.negative ? 'red' : 'black')};
  font-weight: bold;
`;

// --- Компонент UpdateData ---
const UpdateData = () => {
  // Общие данные: фактические показатели
  const [pickedActual, setPickedActual] = useState(0);
  const [packedActual, setPackedActual] = useState(0);
  // Настройки и результаты расчётов
  const [settings, setSettings] = useState(null);
  const [deviations, setDeviations] = useState({});
  const [recommendations, setRecommendations] = useState({});
  // Данные контрольных точек
  const [cpData, setCpData] = useState([]);
  const initialRender = useRef(true);

  // Загрузка updateData из localStorage
  useEffect(() => {
    const savedUpdateData = localStorage.getItem('updateData');
    if (savedUpdateData) {
      const parsed = JSON.parse(savedUpdateData);
      setPickedActual(parsed.pickedActual);
      setPackedActual(parsed.packedActual);
      if (parsed.cpData) {
        setCpData(parsed.cpData);
      }
    }
  }, []);

  // Автосохранение updateData
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    const dataToSave = { pickedActual, packedActual, cpData };
    localStorage.setItem('updateData', JSON.stringify(dataToSave));
  }, [pickedActual, packedActual, cpData]);

  // Загрузка настроек
  useEffect(() => {
    const storedSettings = localStorage.getItem('settings');
    if (storedSettings) {
      setSettings(JSON.parse(storedSettings));
    }
  }, []);

  // Инициализация cpData, если данных нет
  useEffect(() => {
    const savedUpdateData = localStorage.getItem('updateData');
    const parsedData = savedUpdateData ? JSON.parse(savedUpdateData) : {};
    if ((!parsedData.cpData || parsedData.cpData.length === 0) &&
        settings && settings.controlPoints && settings.controlPoints.length > 0) {
      const initialCPData = settings.controlPoints.map(cp => ({
        time: cp.time,
        plannedPacked: calculateExpectedAtTime(settings, cp.time),
        actualPacked: 0,
        plannedPicked: calculateExpectedAtTime(settings, cp.time),
        actualPicked: 0,
      }));
      setCpData(initialCPData);
    }
  }, [settings]);

  // Пересчёт общих результатов и рекомендаций
  const recalc = useCallback(() => {
    if (settings) {
      const calcDev = calculateDeviations(settings, pickedActual, packedActual);
      setDeviations(calcDev);
      const calcRec = calculateRecommendations(calcDev, settings);
      setRecommendations(calcRec);
    }
  }, [settings, pickedActual, packedActual]);

  useEffect(() => {
    recalc();
    const timer = setInterval(recalc, 60000);
    return () => clearInterval(timer);
  }, [recalc]);

  // --- Дополнительные вычисления для всего дня ---
  const actualSpeedPicking = deviations.hoursPassed > 0 ? pickedActual / deviations.hoursPassed : 0;
  const actualSpeedPacking = deviations.hoursPassed > 0 ? packedActual / deviations.hoursPassed : 0;
  const requiredSpeed = deviations.requiredSpeed || 0;
  const recommendedPeoplePicking = settings ? requiredSpeed / Number(settings.avgPickingSpeed) : 0;
  const recommendedPeoplePacking = settings ? requiredSpeed / Number(settings.avgPackingSpeed) : 0;

  // --- Вычисления для показателей последнего часа ---
  // Оставшиеся часы работы: totalWorkTime - hoursWorked
  const remainingHours = deviations.totalWorkTime ? (deviations.totalWorkTime - deviations.hoursPassed) : 0;
  // Общий оставшийся объём заказов на весь оставшийся период
  const remainingOrdersPicking_total = settings ? Number(settings.expectedOrders) - pickedActual : 0;
  const remainingOrdersPacking_total = settings ? Number(settings.expectedOrders) - packedActual : 0;
  // Требуемая скорость для последнего часа (orders/hour)
  const requiredSpeedLastHourPicking = remainingHours > 0 ? remainingOrdersPicking_total / remainingHours : 0;
  const requiredSpeedLastHourPacking = remainingHours > 0 ? remainingOrdersPacking_total / remainingHours : 0;
  // Округлённые значения для отображения
  const remainingOrdersPicking_lastHour = Math.round(requiredSpeedLastHourPicking);
  const remainingOrdersPacking_lastHour = Math.round(requiredSpeedLastHourPacking);
  // Новый расчёт по формуле:
  // Total remaining unprocessed orders (last hour) = (staffForLastPeriod * avgPackingSpeed) - (Remaining orders for Picking (last hour) + Remaining orders for Packing (last hour))
  const staffLastHour = settings ? Number(settings.staffForLastPeriod) : 0;
  const avgPackingSpeed = settings ? Number(settings.avgPackingSpeed) : 0;
  const totalRemainingUnprocessedLastHour = settings 
    ? (staffLastHour * avgPackingSpeed) - (remainingOrdersPicking_lastHour + remainingOrdersPacking_lastHour)
    : 0;

  // --- Вывод текстового сообщения для последнего часа ---
  // Если totalRemainingUnprocessedLastHour >= 0, выводим только сообщение (зеленым), иначе - число и сообщение (красным)
  const statusDisplay =
    totalRemainingUnprocessedLastHour >= 0 ? (
      <StatusText positive>Plan will be met on time</StatusText>
    ) : (
      <StatusText negative>{Math.abs(totalRemainingUnprocessedLastHour)} orders – Plan will not be met on time</StatusText>
    );

  // --- Дополнительное количество сотрудников для последнего часа ---
  const additionalStaffPicking_lastHour =
    settings && Number(settings.avgPickingSpeed) > 0 && requiredSpeedLastHourPicking > Number(settings.avgPickingSpeed)
      ? (requiredSpeedLastHourPicking - Number(settings.avgPickingSpeed)) / Number(settings.avgPickingSpeed)
      : 0;
  const additionalStaffPacking_lastHour =
    settings && Number(settings.avgPackingSpeed) > 0 && requiredSpeedLastHourPacking > Number(settings.avgPackingSpeed)
      ? (requiredSpeedLastHourPacking - Number(settings.avgPackingSpeed)) / Number(settings.avgPackingSpeed)
      : 0;

  // --- Прогресс выполнения (Packing) ---
  const progressPercentage =
    settings && settings.expectedOrders
      ? Math.min((packedActual / Number(settings.expectedOrders)) * 100, 100)
      : 0;

  // --- Функции обновления данных контрольных точек ---
  const updateCPField = (index, field, value) => {
    const newCPData = [...cpData];
    newCPData[index] = { ...newCPData[index], [field]: Number(value) };
    setCpData(newCPData);
  };

  const updateCPTime = (index, value) => {
    const newCPData = [...cpData];
    newCPData[index] = {
      time: value,
      actualPacked: cpData[index]?.actualPacked || 0,
      actualPicked: cpData[index]?.actualPicked || 0,
      plannedPacked: settings && value ? calculateExpectedAtTime(settings, value) : 0,
      plannedPicked: settings && value ? calculateExpectedAtTime(settings, value) : 0,
    };
    setCpData(newCPData);
  };

  // --- Кнопка сохранения ---
  const handleSaveAll = () => {
    const dataToSave = { pickedActual, packedActual, cpData };
    localStorage.setItem('updateData', JSON.stringify(dataToSave));
    alert("All data has been updated and saved!");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Container>
        <h1>🔄 Update Process Data</h1>
        {/* Block 1: General Data */}
        <FormContainer>
          <FormField>
            <Label>Actual number of orders picked:</Label>
            <Input type="number" value={pickedActual} onChange={(e) => setPickedActual(Number(e.target.value))} />
          </FormField>
          <FormField>
            <Label>Actual number of orders packed:</Label>
            <Input type="number" value={packedActual} onChange={(e) => setPackedActual(Number(e.target.value))} />
          </FormField>
        </FormContainer>

        <ResultsContainer>
          {/* Block 2: Main Indicators */}
          <SectionTitle>Main Indicators</SectionTitle>
          {settings && (
            <div>
              <p>Hours worked: {deviations.hoursPassed ? deviations.hoursPassed.toFixed(2) : 0}</p>
              <p>
                Expected number of processed orders by that time: {deviations.expectedProcessed ? deviations.expectedProcessed.toFixed(2) : 0}
              </p>
              <p>Required overall speed: {requiredSpeed.toFixed(2)} orders/hour</p>
              <p>Actual overall speed (Picking): {actualSpeedPicking.toFixed(2)} orders/hour</p>
              <p>Actual overall speed (Packing): {actualSpeedPacking.toFixed(2)} orders/hour</p>
              <p>Recommended staff for Picking today: {recommendedPeoplePicking.toFixed(2)}</p>
              <p>Recommended staff for Packing today: {recommendedPeoplePacking.toFixed(2)}</p>
            </div>
          )}

          {/* Block 3: Last Hour Indicators */}
          <SectionTitle>Last Hour Indicators</SectionTitle>
          {settings && remainingHours > 0 && (
            <div>
              <p>Remaining orders for Picking (last hour): {remainingOrdersPicking_lastHour} orders</p>
              <p>Remaining orders for Packing (last hour): {remainingOrdersPacking_lastHour} orders</p>
              <p>
                Total remaining unprocessed orders (last hour): {statusDisplay}
              </p>
              <p>Staff needed for Picking (last hour): {additionalStaffPicking_lastHour.toFixed(2)}</p>
              <p>Staff needed for Packing (last hour): {additionalStaffPacking_lastHour.toFixed(2)}</p>
            </div>
          )}

          {/* Block 4: Deviations and Recommendations */}
          <SectionTitle>Deviations and Recommendations</SectionTitle>
          <div>
            <p>Deviation (Packing): {deviations.packingDeviation ? deviations.packingDeviation.toFixed(2) : 0}</p>
            <p>Deviation (Picking): {deviations.pickingDeviation ? deviations.pickingDeviation.toFixed(2) : 0}</p>
          </div>
          <div style={{ marginTop: '20px' }}>
            <p>{recommendations.packing}</p>
            <p>{recommendations.picking}</p>
          </div>

          {/* Block 5: Progress */}
          <SectionTitle>Progress</SectionTitle>
          <div>
            <p style={{ fontWeight: '500', marginBottom: '8px' }}>
              Packing progress: {progressPercentage.toFixed(0)}%
            </p>
            <ProgressBarContainer>
              <ProgressBar
                width={progressPercentage}
                initial={{ width: 0 }}
                animate={{ width: `${progressPercentage}%` }}
                transition={{ duration: 0.5 }}
              />
            </ProgressBarContainer>
          </div>
        </ResultsContainer>

        {/* Block 6: Control Points */}
        {settings && settings.controlPoints && settings.controlPoints.length > 0 && (
          <ControlPointContainer>
            <SectionTitle>Control Points</SectionTitle>
            {cpData && cpData.length > 0 ? (
              cpData.map((cp, index) => {
                if (!cp.time) return null;
                const expectedAtCP = calculateExpectedAtTime(settings, cp.time);
                return (
                  <CPBlock key={index}>
                    <p>
                      <strong>Control Point Time:</strong>{' '}
                      <Input type="time" value={cp.time} onChange={(e) => updateCPTime(index, e.target.value)} style={{ maxWidth: '100px' }} />
                    </p>
                    <p>
                      <strong>Planned (Packing):</strong> {expectedAtCP.toFixed(0)} | <strong>Actual (Packing):</strong>{' '}
                      <Input type="number" value={cp.actualPacked} onChange={(e) => updateCPField(index, 'actualPacked', e.target.value)} style={{ width: '80px' }} />
                    </p>
                    <p>
                      <strong>Planned (Picking):</strong> {expectedAtCP.toFixed(0)} | <strong>Actual (Picking):</strong>{' '}
                      <Input type="number" value={cp.actualPicked} onChange={(e) => updateCPField(index, 'actualPicked', e.target.value)} style={{ width: '80px' }} />
                    </p>
                    <div>
                      <p>
                        <strong>Deviation (Packing):</strong> {(cp.actualPacked - expectedAtCP).toFixed(2)}
                      </p>
                      <p>
                        <strong>Deviation (Picking):</strong> {(cp.actualPicked - expectedAtCP).toFixed(2)}
                      </p>
                    </div>
                    <SmallButton onClick={() => {
                      const newCP = cpData.filter((_, i) => i !== index);
                      setCpData(newCP);
                    }}>
                      Delete Control Point
                    </SmallButton>
                  </CPBlock>
                );
              })
            ) : (
              <p>No control point data available</p>
            )}
          </ControlPointContainer>
        )}

        {/* Block 7: Save Button */}
        <div style={{ marginTop: '30px', textAlign: 'center' }}>
          <Button onClick={handleSaveAll}>Save All Data</Button>
        </div>
      </Container>
    </motion.div>
  );
};

export default UpdateData;
