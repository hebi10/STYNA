import { useId } from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export default function Input({ 
  label, 
  error, 
  helperText, 
  className = '', 
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
  ...props 
}: InputProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = [
    ariaDescribedBy,
    error ? `${inputId}-error` : undefined,
    !error && helperText ? `${inputId}-helper` : undefined,
  ].filter(Boolean).join(' ') || undefined;
  
  const inputClasses = [
    styles.input,
    error ? styles.inputError : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={styles.container}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input
        {...props}
        id={inputId}
        className={inputClasses}
        aria-invalid={error ? true : ariaInvalid}
        aria-describedby={describedBy}
      />
      {error && (
        <p id={`${inputId}-error`} role="alert" className={styles.error}>{error}</p>
      )}
      {helperText && !error && (
        <p id={`${inputId}-helper`} className={styles.helperText}>{helperText}</p>
      )}
    </div>
  );
}
