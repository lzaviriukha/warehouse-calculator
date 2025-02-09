// src/components/Button.js
import styled from 'styled-components';

const Button = styled.button`
  padding: 14px 28px;
  background: linear-gradient(90deg, #007aff, #0051a8);
  border: none;
  border-radius: 10px;
  color: #fff;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.3s ease, transform 0.2s ease;
  
  &:hover {
    background: linear-gradient(90deg, #0051a8, #003e7e);
    transform: translateY(-2px);
  }
  
  &:active {
    transform: translateY(0);
  }
`;

export default Button;
