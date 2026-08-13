import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export enum AnalyticsPeriod {
  TODAY = 'today',
  WEEK = 'week',
  MONTH = 'month',
  YEAR = 'year',
  ALL = 'all',
}

export class AnalyticsFilterDto {
  @IsOptional()
  @IsEnum(AnalyticsPeriod)
  period?: AnalyticsPeriod;
  @IsOptional()
  @IsDateString()
  startDate?: string; // Format ISO: 'YYYY-MM-DD'
  @IsOptional()
  @IsDateString()
  endDate?: string; // Format ISO: 'YYYY-MM-DD'
}
