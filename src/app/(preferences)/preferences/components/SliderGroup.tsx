'use client';

type Slider = {
  id: string;
  label: string;
  minValue: number;
  maxValue: number;
  defaultValue: number;
  step: number;
  order: number;
};

type Props = {
  sliders: Slider[];
  values: Record<string, number>;
  onChange: (values: Record<string, number>) => void;
};

export function SliderGroup({ sliders, values, onChange }: Props) {
  function handleChange(sliderId: string, value: number) {
    onChange({ ...values, [sliderId]: value });
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2">
      {sliders.map((slider) => {
        const value = values[slider.id] ?? slider.defaultValue;
        return (
          <div key={slider.id} className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">{slider.label} ({slider.minValue}-{slider.maxValue})</label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={slider.minValue}
                max={slider.maxValue}
                step={slider.step}
                value={value}
                onChange={(e) => handleChange(slider.id, parseInt(e.target.value, 10))}
                className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-gray-200 accent-primary dark:bg-gray-700"
              />
              <span className="min-w-[2rem] text-center text-lg font-semibold text-primary">
                {value}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
