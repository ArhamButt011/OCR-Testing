declare module 'react-datetime' {
    import { ComponentType } from "react";
  
    interface DatetimeProps {
      value?: Date | string;
      onChange?: (value: Date) => void;
      input?: boolean;
      [key: string]: any;
    }
  
    const Datetime: ComponentType<DatetimeProps>;
    export default Datetime;
  }
  