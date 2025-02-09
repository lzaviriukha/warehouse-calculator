// src/components/NavBar.js
import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const Nav = styled.nav`
  background: #fff;
  padding: 12px 24px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 40px;
`;

const NavLink = styled(Link)`
  font-size: 18px;
  font-weight: 500;
  color: #007aff;
  transition: color 0.3s ease;
  
  &:hover {
    color: #0051a8;
  }
`;

const NavBar = () => {
  return (
    <Nav>
      <NavLink to="/">Shift Settings</NavLink>
      <NavLink to="/update">Update Data</NavLink>
      <NavLink to="/analytics">Analytics & Reports</NavLink>
    </Nav>
  );
};

export default NavBar;
