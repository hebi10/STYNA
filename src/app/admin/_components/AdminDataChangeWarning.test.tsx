import { fireEvent, render, screen, within } from '@testing-library/react';
import AdminDataChangeWarning from './AdminDataChangeWarning';

jest.mock('./AdminDataChangeWarning.module.css', () => ({
  __esModule: true,
  default: new Proxy({}, {
    get: (_target, property) => String(property),
  }),
}), { virtual: true });

describe('AdminDataChangeWarning', () => {
  test('warns that administrator functions are available but existing data must not be changed', () => {
    render(<AdminDataChangeWarning onClose={jest.fn()} />);

    const dialog = screen.getByRole('dialog', { name: '데이터 수정 전 안내' });

    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByText('관리자 기능은 모두 정상적으로 사용할 수 있습니다.')).toBeInTheDocument();
    expect(within(dialog).getByText('기존 데이터를 수정·삭제·추가하지 말아 주세요.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/데모/)).not.toBeInTheDocument();
  });

  test('closes from the confirmation button, background click, and Escape key', () => {
    const onClose = jest.fn();
    const { rerender } = render(<AdminDataChangeWarning onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '확인했습니다' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(<AdminDataChangeWarning onClose={onClose} />);
    fireEvent.click(screen.getByTestId('admin-data-warning-overlay'));
    expect(onClose).toHaveBeenCalledTimes(2);

    rerender(<AdminDataChangeWarning onClose={onClose} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(3);
  });
});
