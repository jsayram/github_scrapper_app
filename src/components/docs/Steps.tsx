'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { CheckCircle2 } from 'lucide-react';

interface StepsProps {
  children: React.ReactNode;
  className?: string;
}

interface StepProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export const Steps: React.FC<StepsProps> = ({ children, className }) => {
  return (
    <div className={cn('my-6 space-y-4', className)}>
      {React.Children.map(children, (child, index) => {
        if (React.isValidElement<StepProps>(child)) {
          return React.cloneElement(child, {
            ...child.props,
            // @ts-ignore - adding step number
            stepNumber: index + 1,
          });
        }
        return child;
      })}
    </div>
  );
};

export const Step: React.FC<StepProps & { stepNumber?: number }> = ({
  title,
  children,
  className,
  stepNumber,
}) => {
  return (
    <div className={cn('relative pl-10', className)}>
      {/* Step number circle */}
      <div className="absolute left-0 top-0 flex items-center justify-center w-7 h-7 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
        {stepNumber}
      </div>
      
      {/* Connecting line */}
      <div className="absolute left-3.5 top-7 bottom-0 w-px bg-border -translate-x-1/2" />
      
      {/* Content */}
      <div className="pb-6">
        <h4 className="font-semibold text-foreground mb-2">{title}</h4>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
};

export default Steps;
