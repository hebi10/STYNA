function removeTemporaryLink(link: HTMLAnchorElement): void {
  try {
    link.remove();
  } catch {
    link.parentNode?.removeChild(link);
  }
}

export function downloadUsersCsv(csvContent: string, date: Date = new Date()): void {
  const filename = `users_${date.toISOString().split('T')[0]}.csv`;
  const link = document.createElement('a');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const objectUrl = URL.createObjectURL(blob);

  try {
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
  } finally {
    try {
      removeTemporaryLink(link);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }
}
