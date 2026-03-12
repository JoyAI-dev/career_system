/**
 * ZhiPu GLM-OCR client for student ID card recognition.
 *
 * Uses the layout_parsing API with base64 image input.
 * Extracts: name, school, major, grade/type, enrollment year.
 *
 * API key: ZHIPU_API_KEY environment variable.
 */

const API_URL = 'https://open.bigmodel.cn/api/paas/v4/layout_parsing';

export type StudentIdInfo = {
  name?: string;
  school?: string;
  major?: string;
  grade?: string;
};

type LayoutItem = {
  content?: string;
  label: string;
  native_label: string;
};

/**
 * Call ZhiPu GLM-OCR to recognize a student ID card image.
 * Returns extracted student information.
 */
export async function ocrStudentId(
  buffer: Buffer,
  mimeType: string,
): Promise<StudentIdInfo> {
  const apiKey = process.env.ZHIPU_API_KEY;
  if (!apiKey) {
    console.error('[zhipu-ocr] ZHIPU_API_KEY not configured, skipping OCR');
    return {};
  }

  const b64 = buffer.toString('base64');
  const dataUri = `data:${mimeType};base64,${b64}`;

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: 'glm-ocr', file: dataUri }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[zhipu-ocr] API error ${response.status}: ${text}`);
    return {};
  }

  const data = await response.json();
  return parseStudentIdOcr(data);
}

/**
 * Parse OCR API response into structured student info.
 *
 * Handles common Chinese student ID formats:
 * - "姓名 XXX" → name
 * - "学校: XXX" or university name in header → school
 * - "院系 XXX" or "专业 XXX" → major
 * - "类别 XXX" → grade (e.g., 本科生/硕士生)
 * - Enrollment year from student number or "入学" field
 */
function parseStudentIdOcr(data: {
  layout_details?: LayoutItem[][];
  md_results?: string;
}): StudentIdInfo {
  const items: LayoutItem[] = (data.layout_details ?? [])[0] ?? [];
  const texts = items
    .filter((item) => item.label === 'text' && item.content)
    .map((item) => item.content!);

  const result: StudentIdInfo = {};

  for (const text of texts) {
    const trimmed = text.replace(/^#+\s*/, '').trim();

    // Name: "姓名 XXX" or "姓名：XXX"
    if (!result.name) {
      const nameMatch = trimmed.match(/姓\s*名[：:\s]+(\S+)/);
      if (nameMatch) {
        result.name = nameMatch[1];
      }
    }

    // School: "学校 XXX" or "大学" / "学院" at the top (standalone school name)
    if (!result.school) {
      const schoolMatch = trimmed.match(/学\s*校[：:\s]+(.+)/);
      if (schoolMatch) {
        result.school = schoolMatch[1].trim();
      } else if (
        /大学|学院/.test(trimmed) &&
        !trimmed.startsWith('院系') &&
        trimmed.length < 30
      ) {
        // Standalone university name (e.g., "清华大学" or "北京大学")
        result.school = trimmed;
      }
    }

    // Major: "院系 XXX" or "专业 XXX"
    if (!result.major) {
      const deptMatch = trimmed.match(/(?:院\s*系|专\s*业|系\s*别)[：:\s]+(.+)/);
      if (deptMatch) {
        // Take only the Chinese part (before English translation)
        const chinese = deptMatch[1].split('\n')[0].trim();
        result.major = chinese;
      }
    }

    // Grade: "类别 XXX" → map to grade level
    if (!result.grade) {
      const typeMatch = trimmed.match(/类\s*别[：:\s]+(.+)/);
      if (typeMatch) {
        const typeText = typeMatch[1].split('\n')[0].trim();
        result.grade = mapStudentType(typeText);
      }
    }

    // Enrollment year from student number (e.g., "2023212609" → 2023)
    if (!result.grade) {
      const yearMatch = trimmed.match(/^(20\d{2})\d{4,}/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1], 10);
        result.grade = `${year}级`;
      }
    }

    // "入学" or "入学日期" field
    if (!result.grade) {
      const enrollMatch = trimmed.match(/入\s*学[日期]*[：:\s]+(20\d{2})/);
      if (enrollMatch) {
        result.grade = `${enrollMatch[1]}级`;
      }
    }
  }

  return result;
}

/**
 * Map student type text to a grade label.
 * "本科生" → "本科", "硕士生" → "硕士", etc.
 */
function mapStudentType(typeText: string): string {
  if (/本科/.test(typeText)) return '本科';
  if (/硕士|研究生/.test(typeText)) return '硕士';
  if (/博士/.test(typeText)) return '博士';
  if (/专科|大专/.test(typeText)) return '专科';
  // Return as-is if we can't map
  return typeText.replace(/生$/, '');
}
