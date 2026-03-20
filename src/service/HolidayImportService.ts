/**
 * 节假日导入服务
 *
 * 功能说明：
 * 1. 从 ICS URL 或本地文件路径导入中国法定节假日数据
 * 2. 解析 ICS 文件，提取节假日信息
 * 3. 根据 DTSTART 和 DTEND 计算假期天数，生成每一天的条目
 * 4. 节假日显示规则：
 *    - vacation（放假）：第一天显示节假日名（如"春节"），后续天显示"休"
 *    - workday（调休）：直接显示"班"
 *    - traditional（传统节日/节气）：显示原始名称
 * 5. 去重规则：按"日期+名称前两字"去重，优先级 vacation > workday > traditional
 *
 * ICS 数据格式示例：
 * BEGIN:VEVENT
 * DTSTART;VALUE=DATE:20260215
 * DTEND;VALUE=DATE:20260224
 * SUMMARY:春节（休）
 * DESCRIPTION:春节（休）
 * END:VEVENT
 *
 * 注意：DTEND 是 exclusive 的，所以实际结束日期是 DTEND - 1 天
 */

import { App, TFile } from "obsidian";
import { Holiday, HolidayType } from "@/src/type/Events";
import { generateEventId } from "@/src/utils/uniqueEventId";
import { IsoUtils } from "@/src/utils/isoUtils";

/**
 * 节假日导入服务
 * 负责从远程 ICS 文件或本地文件导入中国法定节假日数据
 */
export class HolidayImportService {
	/** CORS 代理地址，用于解决跨域问题 */
	private static readonly CORS_PROXY = "https://api.allorigins.win/raw?url=";

	/**
	 * 从 URL 下载 ICS 内容
	 * @param url ICS 文件的 URL 地址
	 * @returns ICS 文件内容
	 */
	private static async fetchFromUrl(url: string): Promise<string> {
		const proxyUrl = `${this.CORS_PROXY}${encodeURIComponent(url)}`;
		const response = await fetch(proxyUrl);

		if (!response.ok) {
			throw new Error(
				`[Yearly Glance] 节假日导入失败: HTTP ${response.status} - ${response.statusText}`
			);
		}

		return await response.text();
	}

	/**
	 * 从本地文件读取 ICS 内容
	 * @param app Obsidian App 实例
	 * @param filePath 文件路径（vault 绝对路径或相对路径）
	 * @returns ICS 文件内容
	 */
	private static async fetchFromFile(app: App, filePath: string): Promise<string> {
		const file = app.vault.getAbstractFileByPath(filePath);
		if (!file) {
			throw new Error(`文件不存在: ${filePath}`);
		}
		if (!(file instanceof TFile)) {
			throw new Error(`路径是文件夹而非文件: ${filePath}`);
		}
		return await app.vault.read(file);
	}

	/**
	 * 导入节假日数据（自动识别来源：URL 或文件路径）
	 * 导入 ICS 中的所有年份数据
	 * @param app Obsidian App 实例
	 * @param source ICS 文件的 URL 或本地文件路径
	 * @returns 解析后的节假日数组
	 */
	static async importFromSource(app: App, source: string): Promise<Holiday[]> {
		try {
			let icsContent: string;

			if (IsoUtils.isUrl(source)) {
				icsContent = await this.fetchFromUrl(source);
			} else {
				icsContent = await this.fetchFromFile(app, source);
			}

			// 验证 ICS 文件格式
			if (!icsContent.includes("BEGIN:VCALENDAR")) {
				throw new Error(
					`[Yearly Glance] 节假日导入失败: 文件不是有效的 ICS 格式`
				);
			}

			// 解析 ICS 内容
			const holidays = this.parseIcs(icsContent);
			return holidays;
		} catch (error) {
			console.error("[Yearly Glance] 节假日导入失败:", error);
			throw error;
		}
	}

	/**
	 * 合并节假日数据
	 * 规则：ICS 有的年份覆盖，没有的年份新增
	 * @param existingHolidays 现有节假日
	 * @param newHolidays 新导入的节假日
	 * @returns 合并后的节假日数组
	 */
	static mergeHolidays(
		existingHolidays: Holiday[],
		newHolidays: Holiday[]
	): Holiday[] {
		// 1. 获取新导入数据的年份集合
		const newYears = new Set<number>();
		for (const h of newHolidays) {
			const year = IsoUtils.getYearFromIsoDate(h.eventDate?.isoDate || "");
			if (year > 0) {
				newYears.add(year);
			}
		}

		// 2. 保留：新数据中没有的年份
		const preserved = existingHolidays.filter((h) => {
			const year = IsoUtils.getYearFromIsoDate(h.eventDate?.isoDate || "");
			return year > 0 && !newYears.has(year);
		});

		// 3. 返回：保留的 + 新导入的
		return [...preserved, ...newHolidays];
	}

	/**
	 * 从 URL 下载并导入节假日数据（兼容性方法）
	 * @param url ICS 文件的 URL 地址
	 * @returns 解析后的节假日数组
	 * @deprecated 请使用 importFromSource 方法
	 */
	static async downloadAndImport(url: string): Promise<Holiday[]> {
		try {
			const icsContent = await this.fetchFromUrl(url);

			if (!icsContent.includes("BEGIN:VCALENDAR")) {
				throw new Error(
					`[Yearly Glance] 节假日导入失败: 下载的文件不是有效的 ICS 格式`
				);
			}

			const holidays = this.parseIcs(icsContent);
			return holidays;
		} catch (error) {
			console.error("[Yearly Glance] 节假日导入失败:", error);
			throw error;
		}
	}

	/**
	 * 解析 ICS 内容并生成节假日数组
	 * @param icsContent ICS 文件内容
	 * @returns 节假日数组
	 */
	private static parseIcs(icsContent: string): Holiday[] {
		const holidays: Holiday[] = [];

		// 提取所有 VEVENT 事件
		const events = this.extractEvents(icsContent);

		// 遍历每个事件，生成节假日条目
		for (const event of events) {
			const summary = event.summary || "";
			const dtstart = event.dtstart || "";
			const dtend = event.dtend || "";

			// 跳过无效事件
			if (!dtstart || !summary) continue;

			// 解析开始日期
			const startParsed = IsoUtils.parseIcsDate(dtstart);
			if (!startParsed) continue;

			// 解析节假日类型（放假/调休/传统节日）
			const { name, holidayType } = this.classifyHoliday(summary);

			// 计算假期起止日期
			const startDate = IsoUtils.createLocalDate(
				startParsed.year,
				startParsed.month,
				startParsed.day
			);

			// 解析结束日期（DTEND 是 exclusive 的，需要减 1 天）
			let endDate = startDate;
			if (dtend) {
				const endParsed = IsoUtils.parseIcsDate(dtend);
				if (endParsed) {
					endDate = IsoUtils.createLocalDate(
						endParsed.year,
						endParsed.month,
						endParsed.day - 1
					);
				}
			}

			// 计算假期天数（包含首尾两天）
			const dayCount = IsoUtils.getDaysBetween(startDate, endDate);

			// 生成每一天的节假日条目
			for (let i = 0; i < dayCount; i++) {
				const currentDate = new Date(startDate);
				currentDate.setDate(startDate.getDate() + i);

				const isoDate = IsoUtils.toLocalDateString(currentDate);

				// 设置显示文字
				// - workday（调休）：直接显示"班"
				// - vacation（放假）：第一天显示节假日名，后续天显示"休"
				// - traditional（传统节日）：显示原始名称
				let displayText: string;
				if (holidayType === "workday") {
					displayText = "班";
				} else if (i === 0) {
					displayText = name;
				} else {
					displayText = "休";
				}

				holidays.push({
					id: generateEventId("holiday"),
					text: displayText,
					eventDate: {
						isoDate,
						calendar: "GREGORIAN",
						userInput: {
							input: isoDate,
							calendar: "GREGORIAN",
						},
					},
					dateArr: [isoDate],
					emoji: this.getEmoji(holidayType),
					color: this.getColor(holidayType),
					remark: event.description || "",
					holidayType,
					holidayName: name,
					isRepeat: false,
				});
			}
		}

		// 去重处理
		return this.deduplicateHolidays(holidays);
	}

	/**
	 * 去重节假日数组
	 * 规则：按"日期+名称前两字"去重，优先级 vacation > workday > traditional
	 *
	 * 例如：
	 * - 元旦节 和 元旦（前两字都是"元旦"）→ 去重，保留 vacation
	 * - 春节 和 情人节（前两字不同）→ 都保留
	 *
	 * @param holidays 节假日数组
	 * @returns 去重后的节假日数组
	 */
	private static deduplicateHolidays(holidays: Holiday[]): Holiday[] {
		const seen = new Map<string, Holiday>();

		for (const h of holidays) {
			const date = h.dateArr?.[0];
			if (!date || !h.text) continue;

			// 使用"日期+名称前两字"作为 key
			const firstTwoChars = h.text.substring(0, 2);
			const key = `${date}|${firstTwoChars}`;

			const existing = seen.get(key);
			if (!existing) {
				// 首次出现，直接添加
				seen.set(key, h);
			} else {
				// 已有条目，按优先级替换
				const priority: Record<HolidayType, number> = {
					vacation: 3,
					workday: 2,
					traditional: 1,
				};
				if (priority[h.holidayType!] > priority[existing.holidayType!]) {
					seen.set(key, h);
				}
			}
		}

		return Array.from(seen.values());
	}

	/**
	 * 从 ICS 内容中提取所有 VEVENT 事件
	 * @param icsContent ICS 文件内容
	 * @returns 事件数组
	 */
	private static extractEvents(
		icsContent: string
	): Array<{
		summary?: string;
		dtstart?: string;
		dtend?: string;
		description?: string;
	}> {
		const events: Array<{
			summary?: string;
			dtstart?: string;
			dtend?: string;
			description?: string;
		}> = [];

		// 匹配所有 VEVENT 块
		const eventMatches = icsContent.match(/BEGIN:VEVENT[\s\S]*?END:VEVENT/g);
		if (!eventMatches) return events;

		for (const eventBlock of eventMatches) {
			// 提取 SUMMARY（事件名称）
			const summaryMatch = eventBlock.match(/SUMMARY:([^\r\n]+)/);
			// 提取 DTSTART（开始日期）
			const dtstartMatch = eventBlock.match(/DTSTART[^:]*:(\d+)/);
			// 提取 DTEND（结束日期）
			const dtendMatch = eventBlock.match(/DTEND[^:]*:(\d+)/);
			// 提取 DESCRIPTION（描述）
			const descMatch = eventBlock.match(/DESCRIPTION:([^\r\n]+)/);

			events.push({
				summary: summaryMatch ? summaryMatch[1] : undefined,
				dtstart: dtstartMatch ? dtstartMatch[1] : undefined,
				dtend: dtendMatch ? dtendMatch[1] : undefined,
				description: descMatch ? descMatch[1] : undefined,
			});
		}

		return events;
	}

	/**
	 * 分类节假日类型
	 * @param summary 事件名称
	 * @returns 节假日名称和类型
	 */
	private static classifyHoliday(
		summary: string
	): { name: string; holidayType: HolidayType } {
		// 放假（包含"（休）"标记）
		if (summary.includes("（休）")) {
			return {
				name: summary.replace("（休）", ""),
				holidayType: "vacation",
			};
		}

		// 调休上班（包含"（班）"标记）
		if (summary.includes("（班）")) {
			return {
				name: summary.replace("（班）", ""),
				holidayType: "workday",
			};
		}

		// 其他（传统节日、节气等）
		return {
			name: summary,
			holidayType: "traditional",
		};
	}

	/**
	 * 根据节假日类型获取对应的 emoji 图标
	 * @param holidayType 节假日类型
	 * @returns emoji 图标
	 */
	private static getEmoji(holidayType: HolidayType): string {
		switch (holidayType) {
			case "vacation":
				return "🎉";
			case "workday":
				return "💼";
			case "traditional":
				return "🌿";
		}
	}

	/**
	 * 根据节假日类型获取对应的颜色
	 * @param holidayType 节假日类型
	 * @returns 十六进制颜色值
	 */
	private static getColor(holidayType: HolidayType): string {
		switch (holidayType) {
			case "vacation":
				return "#ff7875"; // 红色 - 放假庆祝
			case "workday":
				return "#ff4d4f"; // 深红色 - 调休上班
			case "traditional":
				return "#8c8c8c"; // 灰色 - 传统节日/节气，中立不显眼
		}
	}
}
