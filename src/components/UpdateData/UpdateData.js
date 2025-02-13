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

// Styled Components
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
const StatusText = styled.span`
  color: ${props => (props.positive ? 'green' : props.negative ? 'red' : 'black')};
  font-weight: bold;
`;

const UpdateData = () => {
  // Actual processed orders
  const [pickedActual, setPickedActual] = useState(0);
  const [packedActual, setPackedActual] = useState(0);
  // Settings and computed values
  const [settings, setSettings] = useState(null);
  const [deviations, setDeviations] = useState({});
  const [recommendations, setRecommendations] = useState({});
  // Control points
  const [cpData, setCpData] = useState([]);
  const initialRender = useRef(true);

  // Load updateData from localStorage
  useEffect(() => {
    const savedData = localStorage.getItem('updateData');
    if (savedData) {
      const parsed = JSON.parse(savedData);
      setPickedActual(parsed.pickedActual);
      setPackedActual(parsed.packedActual);
      if (parsed.cpData) setCpData(parsed.cpData);
    }
  }, []);

  // Auto-save updateData
  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return;
    }
    const dataToSave = { pickedActual, packedActual, cpData };
    localStorage.setItem('updateData', JSON.stringify(dataToSave));
  }, [pickedActual, packedActual, cpData]);

  // Load settings from localStorage
  useEffect(() => {
    const storedSettings = localStorage.getItem('settings');
    if (storedSettings) {
      setSettings(JSON.parse(storedSettings));
    }
  }, []);

  // Initialize control points if not set
  useEffect(() => {
    const savedData = localStorage.getItem('updateData');
    const parsed = savedData ? JSON.parse(savedData) : {};
    if ((!parsed.cpData || parsed.cpData.length === 0) &&
        settings && settings.controlPoints && settings.controlPoints.length > 0) {
      const initialCP = settings.controlPoints.map(cp => {
        const exp = calculateExpectedAtTime(settings, cp.time);
        return {
          time: cp.time,
          plannedPicking: exp.expectedPicking,
          plannedPacking: exp.expectedPacking,
          actualPicked: 0,
          actualPacked: 0,
        };
      });
      setCpData(initialCP);
    }
  }, [settings]);

  // Recalculate deviations and recommendations periodically
  const recalc = useCallback(() => {
    if (settings) {
      const dev = calculateDeviations(settings, pickedActual, packedActual);
      setDeviations(dev);
      const rec = calculateRecommendations(dev, settings);
      setRecommendations(rec);
    }
  }, [settings, pickedActual, packedActual]);

  useEffect(() => {
    recalc();
    const timer = setInterval(recalc, 60000);
    return () => clearInterval(timer);
  }, [recalc]);

  // Main Indicators:
  // Actual overall speeds = (actual orders / hoursWorked) * 2
  const actualSpeedPicking = deviations.hoursPassed > 0 ? (pickedActual / deviations.hoursPassed) * 2 : 0;
  const actualSpeedPacking = deviations.hoursPassed > 0 ? (packedActual / deviations.hoursPassed) * 2 : 0;
  
  // Recommended staff = required speed / avgSpeed (for each process)
  const avgSpeed = settings ? Number(settings.avgSpeed) : 0;
  const recommendedPeoplePicking = settings && deviations.requiredSpeedPicking ? (deviations.requiredSpeedPicking / (avgSpeed * 2)) : 0;
  const recommendedPeoplePacking = settings && deviations.requiredSpeedPacking ? (deviations.requiredSpeedPacking / (avgSpeed * 2)) : 0;
  
  // Last Hour Indicators:
  // Теперь оставшиеся заказы рассчитываются как абсолютное значение отклонений
  const remainingForPicking = settings ? Math.abs(deviations.pickingDeviation || 0) : 0;
  const remainingForPacking = settings ? Math.abs(deviations.packingDeviation || 0) : 0;
  
  // Общее оставшееся количество заказов (среднее значение):
  const totalRemaining = (remainingForPicking + remainingForPacking) / 2;
  
  // Вместимость последних часов для обоих процессов:
  const capacity = settings ? Number(settings.staffForLastPeriod) * avgSpeed : 0;
  
  // Формируем сообщение для Total remaining unprocessed orders (last hour)
  let totalRemainingMessage = "";
  if (totalRemaining > capacity) {
    totalRemainingMessage = `${Math.round(totalRemaining - capacity)} orders will remain unprocessed – Plan will not be met on time`;
  } else if (totalRemaining === capacity) {
    totalRemainingMessage = "Plan will be met on time";
  } else {
    totalRemainingMessage = "Plan will be met on time";
  }
  
  // Staff needed для каждого процесса = (remaining orders for process) / avgSpeed
  const staffNeededPicking_lastHour = avgSpeed > 0 ? remainingForPicking / (avgSpeed * 2) : 0;
  const staffNeededPacking_lastHour = avgSpeed > 0 ? remainingForPacking / (avgSpeed * 2) : 0;

  // Progress for Packing:
  const progressPercentage =
    settings && settings.expectedOrders
      ? Math.min((packedActual / Number(settings.expectedOrders)) * 100, 100)
      : 0;

  // Functions для обновления данных контрольных точек.
  const updateCPField = (index, field, value) => {
    const newCPData = [...cpData];
    newCPData[index] = { ...newCPData[index], [field]: Number(value) };
    setCpData(newCPData);
  };

  const updateCPTime = (index, value) => {
    const newCPData = [...cpData];
    const exp = calculateExpectedAtTime(settings, value);
    newCPData[index] = {
      time: value,
      plannedPicking: exp.expectedPicking,
      plannedPacking: exp.expectedPacking,
      actualPicked: cpData[index]?.actualPicked || 0,
      actualPacked: cpData[index]?.actualPacked || 0,
    };
    setCpData(newCPData);
  };

  const handleSaveAll = () => {
    const dataToSave = { pickedActual, packedActual, cpData };
    localStorage.setItem('updateData', JSON.stringify(dataToSave));
    alert("All data has been updated and saved!");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <Container>
        <h1>🔄 Update Process Data</h1>
        {/* General Data Inputs */}
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
          {/* Main Indicators */}
          <SectionTitle>Main Indicators</SectionTitle>
          {settings && (
            <div>
              <p>Hours worked: {deviations.hoursPassed ? deviations.hoursPassed.toFixed(2) : 0}</p>
              <p>
                Expected number of processed orders by that time (Picking): {deviations.expectedProcessedPicking ? deviations.expectedProcessedPicking.toFixed(2) : 0}
              </p>
              <p>Required overall speed (Picking): {deviations.requiredSpeedPicking ? deviations.requiredSpeedPicking.toFixed(2) : 0} orders/hour</p>
              <p>Actual overall speed (Picking): {actualSpeedPicking.toFixed(2)} orders/hour</p>
              <p>Recommended staff for Picking today: {recommendedPeoplePicking.toFixed(2)}</p>
              <hr />
              <p>
                Expected number of processed orders by that time (Packing): {deviations.expectedProcessedPacking ? deviations.expectedProcessedPacking.toFixed(2) : 0}
              </p>
              <p>Required overall speed (Packing): {deviations.requiredSpeedPacking ? deviations.requiredSpeedPacking.toFixed(2) : 0} orders/hour</p>
              <p>Actual overall speed (Packing): {actualSpeedPacking.toFixed(2)} orders/hour</p>
              <p>Recommended staff for Packing today: {recommendedPeoplePacking.toFixed(2)}</p>
            </div>
          )}
          {/* Last Hour Indicators */}
          <SectionTitle>Last Hour Indicators</SectionTitle>
          {settings && (
            <div>
              <p>Remaining orders for Picking (last hour): {Math.round(remainingForPicking)} orders</p>
              <p>Remaining orders for Packing (last hour): {Math.round(remainingForPacking)} orders</p>
              <p>
                Total remaining unprocessed orders (last hour):{" "}
                {totalRemaining > capacity ? (
                  <StatusText negative>{totalRemainingMessage}</StatusText>
                ) : (
                  <StatusText positive>{totalRemainingMessage}</StatusText>
                )}
              </p>
              <p>Staff needed for Picking (last hour): {staffNeededPicking_lastHour.toFixed(2)}</p>
              <p>Staff needed for Packing (last hour): {staffNeededPacking_lastHour.toFixed(2)}</p>
            </div>
          )}
          {/* Deviations and Recommendations */}
          <SectionTitle>Deviations and Recommendations</SectionTitle>
          <div>
            <p>Deviation (Picking): {deviations.pickingDeviation ? deviations.pickingDeviation.toFixed(2) : 0}</p>
            <p>Deviation (Packing): {deviations.packingDeviation ? deviations.packingDeviation.toFixed(2) : 0}</p>
          </div>
          <div style={{ marginTop: '20px' }}>
            <p>{recommendations.picking}</p>
            <p>{recommendations.packing}</p>
          </div>
          {/* Progress */}
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
        {/* Control Points */}
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
                      <strong>Control Point Time:</strong>{" "}
                      <Input type="time" value={cp.time} onChange={(e) => updateCPTime(index, e.target.value)} style={{ maxWidth: "100px" }} />
                    </p>
                    <p>
                      <strong>Planned (Picking):</strong> {expectedAtCP.expectedPicking.toFixed(0)} | <strong>Actual (Picking):</strong>{" "}
                      <Input type="number" value={cp.actualPicked} onChange={(e) => updateCPField(index, "actualPicked", e.target.value)} style={{ width: "80px" }} />
                    </p>
                    <p>
                      <strong>Planned (Packing):</strong> {expectedAtCP.expectedPacking.toFixed(0)} | <strong>Actual (Packing):</strong>{" "}
                      <Input type="number" value={cp.actualPacked} onChange={(e) => updateCPField(index, "actualPacked", e.target.value)} style={{ width: "80px" }} />
                    </p>
                    <div>
                      <p>
                        <strong>Deviation (Picking):</strong> {(cp.actualPicked - expectedAtCP.expectedPicking).toFixed(2)}
                      </p>
                      <p>
                        <strong>Deviation (Packing):</strong> {(cp.actualPacked - expectedAtCP.expectedPacking).toFixed(2)}
                      </p>
                    </div>
                    <SmallButton
                      onClick={() => {
                        const newCP = cpData.filter((_, i) => i !== index);
                        setCpData(newCP);
                      }}
                    >
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
        {/* Save Button */}
        <div style={{ marginTop: "30px", textAlign: "center" }}>
          <Button onClick={handleSaveAll}>Save All Data</Button>
        </div>
      </Container>
    </motion.div>
  );
};

export default UpdateData;
