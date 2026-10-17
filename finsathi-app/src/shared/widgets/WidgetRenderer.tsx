import { type WidgetInstance } from './widgetTypes';
import { WidgetContainer } from './WidgetContainer';
import { TaxWidget } from './TaxWidget';
import { SalaryWidget } from './SalaryWidget';
import { LedgerWidget } from './LedgerWidget';
import { TradesWidget } from './TradesWidget';
import { RemindersWidget } from './RemindersWidget';
import { LocalAiChatWidget } from './LocalAiChatWidget';

interface WidgetRendererProps {
  widget: WidgetInstance;
}

export function WidgetRenderer({ widget }: WidgetRendererProps) {
  if (!widget.enabled) return null;

  const renderComponent = () => {
    switch (widget.type) {
      case 'tax':
        return <TaxWidget />;
      case 'salary':
        return <SalaryWidget />;
      case 'ledger':
        return <LedgerWidget />;
      case 'trades':
        return <TradesWidget />;
      case 'reminders':
        return <RemindersWidget />;
      case 'ai-chat':
        return <LocalAiChatWidget />;
      default:
        return <div>Unknown Widget Type: {widget.type}</div>;
    }
  };

  return (
    <WidgetContainer widget={widget}>
      {renderComponent()}
    </WidgetContainer>
  );
}
