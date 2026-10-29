import { Pipe, PipeTransform } from '@angular/core';
import { formatDuration } from '../utils/duration.utils';

@Pipe({
  name: 'duration',
  standalone: true,
})
export class DurationPipe implements PipeTransform {
  transform(seconds: number | null | undefined): string {
    if (seconds == null) return '--:--';
    return formatDuration(seconds);
  }
}
