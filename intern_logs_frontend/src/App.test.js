import { render, screen } from '@testing-library/react';
import App from './App';

test('renders T3Log header', () => {
  render(<App />);
  const brand = screen.getByText(/t3log/i);
  expect(brand).toBeInTheDocument();
});
