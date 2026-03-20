import { EventDate } from "./Date";

export interface Events {
	holidays: Holiday[];
	birthdays: Birthday[];
	customEvents: CustomEvent[];
}

export interface BaseEvent {
	id: string;
	text: string;
	eventDate: EventDate;
	/** @deprecated 使用 eventDate.isoDate 替代 */
	date?: string;
	/** @deprecated 使用 eventDate.calendar 替代 */
	dateType?: "SOLAR" | "LUNAR";
	/** 计算后的公历日期数组（运行时生成） */
	dateArr?: string[];
	emoji?: string;
	color?: string;
	remark?: string;
	isHidden?: boolean;
}

/**
 * 节假日类型
 * vacation: 放假
 * workday: 调休上班
 * traditional: 传统节日/节气
 */
export type HolidayType = "vacation" | "workday" | "traditional";

/**
 * 节日接口
 * type: 节日类型, 内置节日或自定义添加的节日
 * foundDate?: 节日起源日期, 年月日，年月，年，一般用于计算周年
 * holidayType?: 节假日类型
 * holidayName?: 节假日原始名称（用于节假日期间分组显示）
 * isRepeat?: 是否重复（默认 false，不重复，只在原始年份显示）
 */
export interface Holiday extends BaseEvent {
	foundDate?: string;
	holidayType?: HolidayType;
	holidayName?: string;
	isRepeat?: boolean;
}

/**
 * 生日接口
 * nextBirthday: 存放下一次生日(基于当前时间)的公历日期，年月日
 * age?: 年龄(基于当前时间)
 * animal?: 生肖(年月日信息完整前提下)
 * zodiac?: 星座(年月日信息完整前提下)
 */
export interface Birthday extends BaseEvent {
	nextBirthday: string;
	age?: number;
	animal?: string;
	zodiac?: string;
}

/**
 * 自定义事件接口
 * isRepeat: 是否重复
 */
export interface CustomEvent extends BaseEvent {
	isRepeat: boolean;
}

export type EventData = Holiday | Birthday | CustomEvent;

// 事件类型
export type EventType = (typeof EVENT_TYPE_LIST)[number];
export const EVENT_TYPE_LIST = ["customEvent", "birthday", "holiday"] as const;

// 事件类型默认图标
export const EVENT_TYPE_DEFAULT: Record<
	EventType,
	{ emoji: string; color: string }
> = {
	customEvent: { emoji: "📌", color: "#73d13d" },
	birthday: { emoji: "🎂", color: "#fa8c16" },
	holiday: { emoji: "🎉", color: "#ff7875" },
};

export const DEFAULT_EVENTS: Events = {
	holidays: [], // 内置节日将通过验证和合并机制添加
	birthdays: [],
	customEvents: [],
};
