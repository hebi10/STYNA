import { render, screen } from '@testing-library/react';
import Input from './Input';

jest.mock('./Input.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}));

describe('Input accessibility', () => {
  test('connects the input to its validation error', () => {
    render(
      <Input
        id="email"
        label="이메일"
        error="필수 입력입니다"
        required
        autoComplete="email"
      />,
    );

    const input = screen.getByLabelText('이메일');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'email-error');
    expect(screen.getByText('필수 입력입니다')).toHaveAttribute('id', 'email-error');
    expect(screen.getByText('필수 입력입니다')).toHaveAttribute('role', 'alert');
  });

  test('merges an existing description with the generated helper id', () => {
    render(
      <>
        <p id="email-format">아이디와 도메인을 입력하세요.</p>
        <Input
          id="email"
          label="이메일"
          helperText="업무용 이메일을 권장합니다."
          aria-describedby="email-format"
        />
      </>,
    );

    expect(screen.getByLabelText('이메일')).toHaveAttribute(
      'aria-describedby',
      'email-format email-helper',
    );
    expect(screen.getByText('업무용 이메일을 권장합니다.')).toHaveAttribute(
      'id',
      'email-helper',
    );
  });
});
