export const DISCLAIMER_TEXT =
  'This application is a personal wealth tracking and projection tool. Future values are estimates based on user-entered assumptions and are not guaranteed returns or financial advice.';

export function Disclaimer() {
  return (
    <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
      {DISCLAIMER_TEXT}{' '}
      <a href={`${import.meta.env.BASE_URL}privacy.html`} className="underline hover:text-slate-700 dark:hover:text-slate-200">
        Privacy
      </a>
    </p>
  );
}
