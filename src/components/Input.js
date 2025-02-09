// src/components/Input.js
import styled from 'styled-components';

const Input = styled.input`
  padding: 12px 16px;
  border: 1px solid #d1d1d6;
  border-radius: 10px;
  font-size: 16px;
  width: 100%;
  min-width: 120px;  /* Гарантирует минимальную ширину */
  box-sizing: border-box; /* Чтобы padding учитывался в общей ширине */
  transition: border-color 0.3s ease, box-shadow 0.3s ease;
  
  &:focus {
    outline: none;
    border-color: #007aff;
    box-shadow: 0 0 0 2px rgba(0, 122, 255, 0.2);
  }
`;

export default Input;
