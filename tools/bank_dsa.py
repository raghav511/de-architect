# DSA bank: 12 weeks x 7 problems. Run `python3 tools/build_bank.py` to validate and write data/bank/dsa.json.
# Each: t title, lv level, fn function/class name, sig starter, p prompt, tests [[args], expected],
# h hints (no full solution), sol reference solution, why (link to data engineering), optional big/in/out/cls/inplace/sortout/un.
E, M, H = 'Easy', 'Medium', 'Hard'
D = []
def q(**k): D.append(k)

# Week 1 arrays and hash maps
q(w=1, t='Contains duplicate', lv=E, fn='contains_duplicate', sig='def contains_duplicate(nums):',
  p='Return True if any value appears at least twice in nums, otherwise False.',
  tests=[[[[1, 2, 3, 1]], True], [[[1, 2, 3, 4]], False], [[[]], False]],
  h=['Restate: is there any repeat at all?', 'A set remembers what you have seen in O(1) per check.', 'Empty list: no duplicates.', 'seen = set()\nfor x in nums:\n    if x in seen: ...\n    seen.add(x)'],
  sol='def contains_duplicate(nums):\n    seen = set()\n    for x in nums:\n        if x in seen:\n            return True\n        seen.add(x)\n    return False',
  big='(list(range(200000)),)', why='Same check as a primary-key uniqueness test in a data quality suite.')
q(w=1, t='Valid anagram', lv=E, fn='is_anagram', sig='def is_anagram(s, t):',
  p='Return True if t is an anagram of s (same letters, same counts).',
  tests=[[['anagram', 'nagaram'], True], [['rat', 'car'], False], [['a', 'ab'], False]],
  h=['Two strings match if every letter count matches.', 'Count with a dict (or collections.Counter).', 'Different lengths can never match: check first.', 'from collections import Counter\nreturn Counter(s) == ...'],
  sol='def is_anagram(s, t):\n    from collections import Counter\n    return len(s) == len(t) and Counter(s) == Counter(t)', why='Counting by key is GROUP BY in Python.')
q(w=1, t='Two Sum', lv=E, fn='two_sum', sig='def two_sum(nums, target):',
  p='Return the indices of the two numbers in nums that add up to target. Exactly one answer exists.',
  tests=[[[[2, 7, 11, 15], 9], [0, 1]], [[[3, 2, 4], 6], [1, 2]], [[[3, 3], 6], [0, 1]]],
  h=['Two positions whose values add to the target.', 'For x, the partner you need is target - x. How fast can you check you have seen it?', 'For [3, 3], look for the partner before you store x.', 'seen = {}\nfor i, x in enumerate(nums):\n    need = target - x\n    if need in seen:\n        return [seen[need], i]\n    seen[x] = ___'],
  sol='def two_sum(nums, target):\n    seen = {}\n    for i, x in enumerate(nums):\n        need = target - x\n        if need in seen:\n            return [seen[need], i]\n        seen[x] = i',
  big='(list(range(100000)), 199997)', why='Build a hash map from one side, probe with the other: a hash join.')
q(w=1, t='Group anagrams', lv=M, fn='group_anagrams', sig='def group_anagrams(words):',
  p='Group words that are anagrams of each other. Return a list of groups (any order).',
  tests=[[[['eat', 'tea', 'tan', 'ate', 'nat', 'bat']], [['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']]], [[['']], [['']]]],
  sortout=True,
  h=['Words in one group share the same letters.', 'Use a key that is the same for all anagrams: the sorted letters.', 'Empty string is its own group.', "groups = {}\nfor w in words:\n    key = ''.join(sorted(w))\n    groups.setdefault(key, []).append(w)"],
  sol="def group_anagrams(words):\n    groups = {}\n    for w in words:\n        groups.setdefault(''.join(sorted(w)), []).append(w)\n    return list(groups.values())", why='Choosing a grouping key is the heart of every aggregation and dedupe.')
q(w=1, t='Top K frequent elements', lv=M, fn='top_k_frequent', sig='def top_k_frequent(nums, k):',
  p='Return the k most frequent values (any order). The answer is unique.',
  tests=[[[[1, 1, 1, 2, 2, 3], 2], [1, 2]], [[[4], 1], [4]], [[[5, 5, 6, 6, 6, 7], 1], [6]]], un=True,
  h=['Count first, then pick the k biggest counts.', 'Counter + sort is O(n log n). Bucket by count for O(n).', 'k can equal the number of distinct values.', 'from collections import Counter\nc = Counter(nums)\nreturn [x for x, _ in c.most_common(k)]'],
  sol='def top_k_frequent(nums, k):\n    from collections import Counter\n    return [x for x, _ in Counter(nums).most_common(k)]', why='Top-K by count is the classic "most active riders" query.')
q(w=1, t='Product of array except self', lv=M, fn='product_except_self', sig='def product_except_self(nums):',
  p='Return a list where item i is the product of every number except nums[i]. Do not use division.',
  tests=[[[[1, 2, 3, 4]], [24, 12, 8, 6]], [[[-1, 1, 0, -3, 3]], [0, 0, 9, 0, 0]]],
  h=['Each answer = (product of everything left of i) x (everything right of i).', 'Two passes: prefix products, then suffix products.', 'Zeros break the division trick, which is why it is banned.', 'out = [1] * n\nleft = 1\nfor i in range(n): out[i] = left; left *= nums[i]\n# now the same from the right'],
  sol='def product_except_self(nums):\n    n = len(nums)\n    out = [1] * n\n    left = 1\n    for i in range(n):\n        out[i] = left\n        left *= nums[i]\n    right = 1\n    for i in range(n - 1, -1, -1):\n        out[i] *= right\n        right *= nums[i]\n    return out', why='Prefix and suffix passes are running totals, like SUM() OVER (ORDER BY ...).')
q(w=1, t='Longest consecutive sequence', lv=M, fn='longest_consecutive', sig='def longest_consecutive(nums):',
  p='Return the length of the longest run of consecutive integers in nums (any order). Aim for O(n).',
  tests=[[[[100, 4, 200, 1, 3, 2]], 4], [[[0, 3, 7, 2, 5, 8, 4, 6, 0, 1]], 9], [[[]], 0]],
  h=['A run starts at x only if x - 1 is missing.', 'Put everything in a set, then walk forward only from run starts.', 'Duplicates and empty input.', 's = set(nums)\nfor x in s:\n    if x - 1 not in s:\n        # count x, x+1, x+2 ...'],
  sol='def longest_consecutive(nums):\n    s = set(nums)\n    best = 0\n    for x in s:\n        if x - 1 not in s:\n            y = x\n            while y + 1 in s:\n                y += 1\n            best = max(best, y - x + 1)\n    return best',
  big='(list(range(150000, 0, -1)),)', why='The same idea as "gaps and islands": find where a run starts.')

# Week 2 two pointers
q(w=2, t='Valid palindrome', lv=E, fn='is_palindrome', sig='def is_palindrome(s):',
  p='Ignoring case and anything that is not a letter or digit, does s read the same both ways?',
  tests=[[['A man, a plan, a canal: Panama'], True], [['race a car'], False], [[' '], True]],
  h=['Compare the cleaned string with its reverse, or use two pointers.', 'Left and right pointers moving inward, skipping non-alphanumerics.', 'A string of only spaces is a palindrome.', 'i, j = 0, len(s) - 1\nwhile i < j:\n    # skip, compare lower(), move'],
  sol='def is_palindrome(s):\n    t = [c.lower() for c in s if c.isalnum()]\n    return t == t[::-1]', why='Cleaning before comparing is what normalisation steps do in ingestion.')
q(w=2, t='Merge sorted array', lv=E, fn='merge', sig='def merge(nums1, m, nums2, n):',
  p='nums1 has m real values followed by n zeros. Merge nums2 (n values) into nums1 in place, sorted.',
  tests=[[[[1, 2, 3, 0, 0, 0], 3, [2, 5, 6], 3], [1, 2, 2, 3, 5, 6]], [[[0], 0, [1], 1], [1]]], inplace=0,
  h=['Filling from the front overwrites values you still need.', 'Fill from the back: the largest goes at the end.', 'When nums2 runs out you are done; leftover nums1 is already in place.', 'i, j, k = m - 1, n - 1, m + n - 1\nwhile j >= 0: ...'],
  sol='def merge(nums1, m, nums2, n):\n    i, j, k = m - 1, n - 1, m + n - 1\n    while j >= 0:\n        if i >= 0 and nums1[i] > nums2[j]:\n            nums1[k] = nums1[i]; i -= 1\n        else:\n            nums1[k] = nums2[j]; j -= 1\n        k -= 1', why='Merging two sorted runs is how sort-merge join and compaction work.')
q(w=2, t='Remove duplicates from sorted array', lv=E, fn='remove_duplicates', sig='def remove_duplicates(nums):',
  p='nums is sorted. Remove repeats in place so the first k slots hold the unique values. Return k.',
  tests=[[[[1, 1, 2]], 2], [[[0, 0, 1, 1, 1, 2, 2, 3, 3, 4]], 5], [[[]], 0]],
  h=['Sorted means repeats sit next to each other.', 'A slow pointer marks where the next unique value goes.', 'Empty list returns 0.', 'k = 1\nfor i in range(1, len(nums)):\n    if nums[i] != nums[k - 1]: ...'],
  sol='def remove_duplicates(nums):\n    if not nums:\n        return 0\n    k = 1\n    for i in range(1, len(nums)):\n        if nums[i] != nums[k - 1]:\n            nums[k] = nums[i]\n            k += 1\n    return k', why='Dedupe on sorted input needs no hash table, which is why sorted files dedupe cheaply.')
q(w=2, t='Two Sum II (sorted input)', lv=M, fn='two_sum_sorted', sig='def two_sum_sorted(numbers, target):',
  p='numbers is sorted ascending. Return the 1-based indices [i, j] of two numbers that add to target, using O(1) extra space.',
  tests=[[[[2, 7, 11, 15], 9], [1, 2]], [[[2, 3, 4], 6], [1, 3]], [[[-1, 0], -1], [1, 2]]],
  h=['Sorted order tells you which way to move.', 'Pointers at both ends: too small, move left up; too big, move right down.', 'Indices are 1-based.', 'i, j = 0, len(numbers) - 1\nwhile i < j:\n    s = numbers[i] + numbers[j]'],
  sol='def two_sum_sorted(numbers, target):\n    i, j = 0, len(numbers) - 1\n    while i < j:\n        s = numbers[i] + numbers[j]\n        if s == target:\n            return [i + 1, j + 1]\n        if s < target:\n            i += 1\n        else:\n            j -= 1', why='When data is already sorted you trade memory for a single scan.')
q(w=2, t='Move zeroes', lv=E, fn='move_zeroes', sig='def move_zeroes(nums):',
  p='Move every 0 to the end of nums in place, keeping the order of the other values.',
  tests=[[[[0, 1, 0, 3, 12]], [1, 3, 12, 0, 0]], [[[0]], [0]], [[[1, 2]], [1, 2]]], inplace=0,
  h=['Non-zero values keep their relative order.', 'A write pointer for the next non-zero slot.', 'All zeros or no zeros.', 'w = 0\nfor x in nums:\n    if x != 0: nums[w] = x; w += 1\n# fill the rest with 0'],
  sol='def move_zeroes(nums):\n    w = 0\n    for x in nums:\n        if x != 0:\n            nums[w] = x\n            w += 1\n    for i in range(w, len(nums)):\n        nums[i] = 0', why='A stable filter, like WHERE keeping row order.')
q(w=2, t='Container with most water', lv=M, fn='max_area', sig='def max_area(height):',
  p='height[i] is a wall. Pick two walls that hold the most water: (j - i) * min(height[i], height[j]).',
  tests=[[[[1, 8, 6, 2, 5, 4, 8, 3, 7]], 49], [[[1, 1]], 1]],
  h=['Start with the widest pair.', 'Moving the taller wall can never help, so move the shorter one.', 'Equal heights: moving either is fine.', 'i, j = 0, len(height) - 1\nbest = 0\nwhile i < j: ...'],
  sol='def max_area(height):\n    i, j, best = 0, len(height) - 1, 0\n    while i < j:\n        best = max(best, (j - i) * min(height[i], height[j]))\n        if height[i] < height[j]:\n            i += 1\n        else:\n            j -= 1\n    return best', big='(list(range(1, 100001)),)', why='Greedy pruning: skip work you can prove is useless, like partition pruning.')
q(w=2, t='3Sum', lv=M, fn='three_sum', sig='def three_sum(nums):',
  p='Return all unique triplets that add up to 0 (any order).',
  tests=[[[[-1, 0, 1, 2, -1, -4]], [[-1, -1, 2], [-1, 0, 1]]], [[[0, 0, 0]], [[0, 0, 0]]], [[[0, 1, 1]], []]], sortout=True,
  h=['Fix one number, then it is Two Sum II on the rest.', 'Sort first so you can use two pointers and skip duplicates.', 'Skip equal neighbours so a triplet is reported once.', 'nums.sort()\nfor i in range(len(nums)):\n    if i and nums[i] == nums[i-1]: continue\n    # two pointers on i+1..end'],
  sol='def three_sum(nums):\n    nums.sort()\n    out = []\n    for i in range(len(nums)):\n        if i and nums[i] == nums[i - 1]:\n            continue\n        l, r = i + 1, len(nums) - 1\n        while l < r:\n            s = nums[i] + nums[l] + nums[r]\n            if s < 0:\n                l += 1\n            elif s > 0:\n                r -= 1\n            else:\n                out.append([nums[i], nums[l], nums[r]])\n                l += 1\n                while l < r and nums[l] == nums[l - 1]:\n                    l += 1\n    return out', why='Sort once, then many cheap scans: the reason warehouses cluster data.')

# Week 3 sliding window
q(w=3, t='Maximum average subarray', lv=E, fn='find_max_average', sig='def find_max_average(nums, k):',
  p='Return the largest average of any k consecutive numbers.',
  tests=[[[[1, 12, -5, -6, 50, 3], 4], 12.75], [[[5], 1], 5.0]],
  h=['Every window of size k.', 'Keep a running sum: add the new item, drop the oldest.', 'k equals the length.', 's = sum(nums[:k]); best = s\nfor i in range(k, len(nums)):\n    s += nums[i] - nums[i - k]'],
  sol='def find_max_average(nums, k):\n    s = best = sum(nums[:k])\n    for i in range(k, len(nums)):\n        s += nums[i] - nums[i - k]\n        best = max(best, s)\n    return best / k', why='A rolling average over the last k events: ROWS BETWEEN k-1 PRECEDING.')
q(w=3, t='Best time to buy and sell stock', lv=E, fn='max_profit', sig='def max_profit(prices):',
  p='Buy on one day and sell on a later day. Return the best profit, or 0.',
  tests=[[[[7, 1, 5, 3, 6, 4]], 5], [[[7, 6, 4, 3, 1]], 0]],
  h=['Best sale today = today minus the lowest price so far.', 'Track the running minimum.', 'Falling prices: answer 0.', 'low = float("inf"); best = 0\nfor p in prices: ...'],
  sol="def max_profit(prices):\n    low, best = float('inf'), 0\n    for p in prices:\n        low = min(low, p)\n        best = max(best, p - low)\n    return best", why='Running minimum is MIN() OVER (ORDER BY day).')
q(w=3, t='Longest substring without repeats', lv=M, fn='length_of_longest_substring', sig='def length_of_longest_substring(s):',
  p='Return the length of the longest substring with no repeated characters.',
  tests=[[['abcabcbb'], 3], [['bbbbb'], 1], [['pwwkew'], 3], [[''], 0]],
  h=['A window that grows right and shrinks left.', 'Remember the last index of each character; jump the left edge past a repeat.', 'Do not move the left edge backwards.', 'last = {}; left = 0\nfor i, c in enumerate(s):\n    if c in last and last[c] >= left: left = last[c] + 1'],
  sol='def length_of_longest_substring(s):\n    last, left, best = {}, 0, 0\n    for i, c in enumerate(s):\n        if c in last and last[c] >= left:\n            left = last[c] + 1\n        last[c] = i\n        best = max(best, i - left + 1)\n    return best', why='Window state that grows and shrinks is how session windows work in streaming.')
q(w=3, t='Minimum size subarray sum', lv=M, fn='min_subarray_len', sig='def min_subarray_len(target, nums):',
  p='nums are positive. Return the length of the shortest contiguous run with sum >= target, or 0.',
  tests=[[[7, [2, 3, 1, 2, 4, 3]], 2], [[4, [1, 4, 4]], 1], [[11, [1, 1, 1, 1]], 0]],
  h=['Grow until the sum is big enough, then shrink while it still is.', 'Positive numbers make the window monotonic.', 'Return 0 when no window works.', 'left = s = 0; best = inf\nfor right, x in enumerate(nums): ...'],
  sol="def min_subarray_len(target, nums):\n    left = s = 0\n    best = float('inf')\n    for right, x in enumerate(nums):\n        s += x\n        while s >= target:\n            best = min(best, right - left + 1)\n            s -= nums[left]\n            left += 1\n    return 0 if best == float('inf') else best", why='Shortest window meeting a threshold: think "minimum batch that fills a file".')
q(w=3, t='Permutation in string', lv=M, fn='check_inclusion', sig='def check_inclusion(s1, s2):',
  p='Return True if some substring of s2 is a permutation of s1.',
  tests=[[['ab', 'eidbaooo'], True], [['ab', 'eidboaoo'], False]],
  h=['A fixed-size window of len(s1) over s2.', 'Compare letter counts of the window with s1; update counts as the window slides.', 's1 longer than s2.', 'need = Counter(s1); win = Counter(s2[:k])\nfor i in range(k, len(s2)): ...'],
  sol='def check_inclusion(s1, s2):\n    from collections import Counter\n    k = len(s1)\n    need, win = Counter(s1), Counter(s2[:k])\n    if win == need:\n        return True\n    for i in range(k, len(s2)):\n        win[s2[i]] += 1\n        win[s2[i - k]] -= 1\n        if win[s2[i - k]] == 0:\n            del win[s2[i - k]]\n        if win == need:\n            return True\n    return False', why='Incremental aggregates over a sliding window, the core of stream processing.')
q(w=3, t='Longest repeating character replacement', lv=M, fn='character_replacement', sig='def character_replacement(s, k):',
  p='You may change up to k characters. Return the longest run of one repeated letter you can make.',
  tests=[[['ABAB', 2], 4], [['AABABBA', 1], 4]],
  h=['A window is fine if (size - count of its most common letter) <= k.', 'Grow right; shrink left when the window breaks the rule.', 'The max count can stay stale; the answer is still right.', 'counts = {}; left = best = top = 0'],
  sol='def character_replacement(s, k):\n    counts, left, top, best = {}, 0, 0, 0\n    for right, c in enumerate(s):\n        counts[c] = counts.get(c, 0) + 1\n        top = max(top, counts[c])\n        while right - left + 1 - top > k:\n            counts[s[left]] -= 1\n            left += 1\n        best = max(best, right - left + 1)\n    return best', why='Keeping a window valid under a budget, like a rate limiter.')
q(w=3, t='Fruit into baskets', lv=M, fn='total_fruit', sig='def total_fruit(fruits):',
  p='Pick the longest contiguous run that has at most 2 different values. Return its length.',
  tests=[[[[1, 2, 1]], 3], [[[0, 1, 2, 2]], 3], [[[1, 2, 3, 2, 2]], 4]],
  h=['Longest window with at most 2 distinct keys.', 'Count keys in the window; shrink when a third appears.', 'Delete a key when its count hits 0.', 'counts = {}; left = 0'],
  sol='def total_fruit(fruits):\n    counts, left, best = {}, 0, 0\n    for right, f in enumerate(fruits):\n        counts[f] = counts.get(f, 0) + 1\n        while len(counts) > 2:\n            counts[fruits[left]] -= 1\n            if counts[fruits[left]] == 0:\n                del counts[fruits[left]]\n            left += 1\n        best = max(best, right - left + 1)\n    return best', why='Distinct-count within a window, like active users in the last N minutes.')

# Week 4 stacks and queues
q(w=4, t='Valid parentheses', lv=E, fn='is_valid', sig='def is_valid(s):',
  p='Return True if every bracket in s is closed by the right type in the right order.',
  tests=[[['()[]{}'], True], [['(]'], False], [['([)]'], False], [['{[]}'], True], [['('], False]],
  h=['The last opened bracket must close first.', 'A stack of open brackets.', 'Leftover opens mean False.', "pairs = {')': '(', ']': '[', '}': '{'}\nstack = []"],
  sol="def is_valid(s):\n    pairs = {')': '(', ']': '[', '}': '{'}\n    st = []\n    for c in s:\n        if c in pairs:\n            if not st or st.pop() != pairs[c]:\n                return False\n        else:\n            st.append(c)\n    return not st", why='Stacks parse nested data: JSON, SQL and DAG configs.')
q(w=4, t='Min stack', lv=M, fn='MinStack', sig='class MinStack:\n    def __init__(self):\n        pass\n    def push(self, val):\n        pass\n    def pop(self):\n        pass\n    def top(self):\n        pass\n    def getMin(self):\n        pass', cls=True,
  p='Design a stack with push, pop, top and getMin, all O(1).',
  tests=[[[['MinStack', 'push', 'push', 'push', 'getMin', 'pop', 'top', 'getMin'], [[], [-2], [0], [-3], [], [], [], []]], [None, None, None, None, -3, None, 0, -2]]],
  h=['Remember the minimum at every level of the stack.', 'Store pairs (value, min so far).', 'getMin after pops must reflect what is left.', 'self.st = []\n# push: self.st.append((val, min(val, current min)))'],
  sol='class MinStack:\n    def __init__(self):\n        self.st = []\n    def push(self, val):\n        m = val if not self.st else min(val, self.st[-1][1])\n        self.st.append((val, m))\n    def pop(self):\n        self.st.pop()\n    def top(self):\n        return self.st[-1][0]\n    def getMin(self):\n        return self.st[-1][1]', why='Carrying an aggregate with each record avoids rescans.')
q(w=4, t='Evaluate reverse Polish notation', lv=M, fn='eval_rpn', sig='def eval_rpn(tokens):',
  p='Evaluate the expression. Division truncates toward zero.',
  tests=[[[['2', '1', '+', '3', '*']], 9], [[['4', '13', '5', '/', '+']], 6], [[['10', '6', '9', '3', '+', '-11', '*', '/', '*', '17', '+', '5', '+']], 22]],
  h=['Numbers go on a stack; an operator uses the top two.', 'Pop b then a, push a op b.', 'int(a / b) truncates toward zero; // does not for negatives.', 'st = []\nfor t in tokens: ...'],
  sol="def eval_rpn(tokens):\n    st = []\n    for t in tokens:\n        if t in '+-*/':\n            b, a = st.pop(), st.pop()\n            st.append(a + b if t == '+' else a - b if t == '-' else a * b if t == '*' else int(a / b))\n        else:\n            st.append(int(t))\n    return st[0]", why='Query engines evaluate expression trees with a stack.')
q(w=4, t='Daily temperatures', lv=M, fn='daily_temperatures', sig='def daily_temperatures(temps):',
  p='For each day, how many days until a warmer one? 0 if none.',
  tests=[[[[73, 74, 75, 71, 69, 72, 76, 73]], [1, 1, 4, 2, 1, 1, 0, 0]], [[[30, 60, 90]], [1, 1, 0]]],
  h=['Days still waiting for a warmer day form a stack.', 'Keep a decreasing stack of indices; a warmer day pops and answers them.', 'Days left at the end stay 0.', 'ans = [0] * n; st = []\nfor i, t in enumerate(temps): ...'],
  sol='def daily_temperatures(temps):\n    ans, st = [0] * len(temps), []\n    for i, t in enumerate(temps):\n        while st and temps[st[-1]] < t:\n            j = st.pop()\n            ans[j] = i - j\n        st.append(i)\n    return ans', big='(list(range(100000, 0, -1)),)', why='Monotonic stacks answer "next event that beats this one" in one pass.')
q(w=4, t='Next greater element', lv=E, fn='next_greater', sig='def next_greater(nums1, nums2):',
  p='nums1 is a subset of nums2. For each x in nums1, return the first larger number to its right in nums2, or -1.',
  tests=[[[[4, 1, 2], [1, 3, 4, 2]], [-1, 3, -1]], [[[2, 4], [1, 2, 3, 4]], [3, -1]]],
  h=['Answer the question for all of nums2 once.', 'Monotonic stack builds a map value -> next greater.', 'Missing means -1.', 'nxt = {}; st = []'],
  sol='def next_greater(nums1, nums2):\n    nxt, st = {}, []\n    for x in nums2:\n        while st and st[-1] < x:\n            nxt[st.pop()] = x\n        st.append(x)\n    return [nxt.get(x, -1) for x in nums1]', why='Precompute once, look up many times: a materialised view.')
q(w=4, t='Queue using two stacks', lv=E, fn='MyQueue', sig='class MyQueue:\n    def __init__(self):\n        pass\n    def push(self, x):\n        pass\n    def pop(self):\n        pass\n    def peek(self):\n        pass\n    def empty(self):\n        pass', cls=True,
  p='Implement a FIFO queue with only stack operations. Amortised O(1).',
  tests=[[[['MyQueue', 'push', 'push', 'peek', 'pop', 'empty'], [[], [1], [2], [], [], []]], [None, None, None, 1, 1, False]]],
  h=['One stack for input, one for output.', 'Only refill the output stack when it is empty.', 'empty() checks both.', 'self.i, self.o = [], []'],
  sol='class MyQueue:\n    def __init__(self):\n        self.i, self.o = [], []\n    def push(self, x):\n        self.i.append(x)\n    def _move(self):\n        if not self.o:\n            while self.i:\n                self.o.append(self.i.pop())\n    def pop(self):\n        self._move()\n        return self.o.pop()\n    def peek(self):\n        self._move()\n        return self.o[-1]\n    def empty(self):\n        return not self.i and not self.o', why='Amortised cost is why batching writes beats writing each row.')
q(w=4, t='Asteroid collision', lv=M, fn='asteroid_collision', sig='def asteroid_collision(asteroids):',
  p='Positive moves right, negative moves left. When they meet the smaller explodes; equal both explode. Return what is left.',
  tests=[[[[5, 10, -5]], [5, 10]], [[[8, -8]], []], [[[10, 2, -5]], [10]], [[[-2, -1, 1, 2]], [-2, -1, 1, 2]]],
  h=['Only a right-mover followed by a left-mover can collide.', 'Stack of survivors; a new left-mover fights the top.', 'Equal sizes remove both.', 'st = []\nfor a in asteroids: ...'],
  sol='def asteroid_collision(asteroids):\n    st = []\n    for a in asteroids:\n        alive = True\n        while alive and a < 0 and st and st[-1] > 0:\n            if st[-1] < -a:\n                st.pop()\n            elif st[-1] == -a:\n                st.pop()\n                alive = False\n            else:\n                alive = False\n        if alive:\n            st.append(a)\n    return st', why='Stack simulation, like resolving upserts and deletes in a CDC stream.')

# Week 5 strings and parsing
q(w=5, t='Reverse words', lv=M, fn='reverse_words', sig='def reverse_words(s):',
  p='Reverse the order of words. Collapse multiple spaces to one and trim the ends.',
  tests=[[['the sky is blue'], 'blue is sky the'], [['  hello world  '], 'world hello'], [['a good   example'], 'example good a']],
  h=['Split on any whitespace.', 'str.split() with no argument already collapses spaces.', 'Leading and trailing spaces.', "return ' '.join(...)"],
  sol="def reverse_words(s):\n    return ' '.join(reversed(s.split()))", why='Tokenising text is the first step of every log parser.')
q(w=5, t='String compression', lv=M, fn='compress', sig='def compress(chars):',
  p="Return the run-length encoded string: 'aabccc' becomes 'a2bc3' (a count of 1 is not written).",
  tests=[[['aabccc'], 'a2bc3'], [['a'], 'a'], [['abbbbbbbbbbbb'], 'ab12']],
  h=['Walk runs of the same character.', 'Count each run, write char + count if count > 1.', 'Counts can be two digits.', 'i = 0\nwhile i < len(chars): ...'],
  sol="def compress(chars):\n    out, i = [], 0\n    while i < len(chars):\n        j = i\n        while j < len(chars) and chars[j] == chars[i]:\n            j += 1\n        out.append(chars[i] + (str(j - i) if j - i > 1 else ''))\n        i = j\n    return ''.join(out)", why='Run-length encoding is how Parquet stores repeated values so cheaply.')
q(w=5, t='Parse log lines', lv=M, fn='error_counts', sig='def error_counts(lines):',
  p="Lines look like '2026-10-20T08:01:02 ERROR svc=payments msg=timeout'. Return {service: count} for ERROR lines only.",
  tests=[[[['2026-10-20T08:01:02 ERROR svc=payments msg=timeout', '2026-10-20T08:01:03 INFO svc=payments msg=ok', '2026-10-20T08:01:04 ERROR svc=search msg=oom', '2026-10-20T08:01:05 ERROR svc=payments msg=retry']], {'payments': 2, 'search': 1}], [[[]], {}]],
  h=['Split each line into parts.', 'Level is the second field; svc is a key=value pair.', 'Ignore lines that are not ERROR.', "for line in lines:\n    parts = line.split()\n    if parts[1] != 'ERROR': continue"],
  sol="def error_counts(lines):\n    out = {}\n    for line in lines:\n        parts = line.split()\n        if len(parts) < 3 or parts[1] != 'ERROR':\n            continue\n        kv = dict(p.split('=', 1) for p in parts[2:] if '=' in p)\n        svc = kv.get('svc')\n        out[svc] = out.get(svc, 0) + 1\n    return out", why='Exactly what your error-analysis agent does before it calls the LLM.')
q(w=5, t='Flatten nested JSON', lv=M, fn='flatten', sig='def flatten(obj):',
  p="Flatten nested dicts into one dict with dotted keys: {'a': {'b': 1}} becomes {'a.b': 1}. Lists stay as values.",
  tests=[[[{'a': 1, 'b': {'c': 2, 'd': {'e': 3}}}], {'a': 1, 'b.c': 2, 'b.d.e': 3}], [[{'x': [1, 2]}], {'x': [1, 2]}], [[{}], {}]],
  h=['Recursion: a dict value means go one level deeper.', 'Carry the key prefix down.', 'Empty dict returns empty.', "def go(o, prefix):\n    for k, v in o.items():\n        key = prefix + '.' + k if prefix else k"],
  sol="def flatten(obj):\n    out = {}\n    def go(o, prefix):\n        for k, v in o.items():\n            key = prefix + '.' + k if prefix else k\n            if isinstance(v, dict) and v:\n                go(v, key)\n            else:\n                out[key] = v\n    go(obj, '')\n    return out", why='Flattening event payloads into columns is a daily ingestion task.')
q(w=5, t='Decode string', lv=M, fn='decode_string', sig='def decode_string(s):',
  p="'3[a2[c]]' becomes 'accaccacc'. Numbers repeat what is inside the brackets.",
  tests=[[['3[a]2[bc]'], 'aaabcbc'], [['3[a2[c]]'], 'accaccacc'], [['2[abc]3[cd]ef'], 'abcabccdcdcdef']],
  h=['Nested brackets: use a stack.', 'On "[" push (current string, count); on "]" pop and repeat.', 'Counts can have many digits.', "st = []; cur = ''; num = 0"],
  sol="def decode_string(s):\n    st, cur, num = [], '', 0\n    for c in s:\n        if c.isdigit():\n            num = num * 10 + int(c)\n        elif c == '[':\n            st.append((cur, num))\n            cur, num = '', 0\n        elif c == ']':\n            prev, k = st.pop()\n            cur = prev + cur * k\n        else:\n            cur += c\n    return cur", why='Stack-based parsing, like expanding templated SQL in dbt.')
q(w=5, t='Simplify path', lv=M, fn='simplify_path', sig='def simplify_path(path):',
  p="Simplify a Unix path: '/a/./b/../../c/' becomes '/c'.",
  tests=[[['/home/'], '/home'], [['/../'], '/'], [['/a/./b/../../c/'], '/c'], [['/home//foo/'], '/home/foo']],
  h=['Split on "/".', 'A stack of folder names: ".." pops, "." and "" do nothing.', 'Root stays "/".', "parts = []\nfor p in path.split('/'): ..."],
  sol="def simplify_path(path):\n    st = []\n    for p in path.split('/'):\n        if p == '..':\n            if st:\n                st.pop()\n        elif p and p != '.':\n            st.append(p)\n    return '/' + '/'.join(st)", why='Normalising object-store paths avoids writing the same data twice.')
q(w=5, t='Validate IP address', lv=M, fn='valid_ip', sig='def valid_ip(ip):',
  p="Return 'IPv4', 'IPv6' or 'Neither'. IPv4: four numbers 0-255 without leading zeros. IPv6: eight groups of 1-4 hex digits.",
  tests=[[['172.16.254.1'], 'IPv4'], [['2001:0db8:85a3:0:0:8A2E:0370:7334'], 'IPv6'], [['256.256.256.256'], 'Neither'], [['01.1.1.1'], 'Neither']],
  h=['Decide by the separator, then check each part.', 'IPv4 part: digits only, no leading zero unless "0", value <= 255.', 'IPv6 part: 1 to 4 chars, all hex.', "if ip.count('.') == 3: ..."],
  sol="def valid_ip(ip):\n    def v4(p):\n        return p.isdigit() and str(int(p)) == p and int(p) <= 255\n    def v6(p):\n        return 1 <= len(p) <= 4 and all(c in '0123456789abcdefABCDEF' for c in p)\n    if ip.count('.') == 3 and all(v4(p) for p in ip.split('.')):\n        return 'IPv4'\n    if ip.count(':') == 7 and all(v6(p) for p in ip.split(':')):\n        return 'IPv6'\n    return 'Neither'", why='Field validation rules, the core of a data contract.')

# Week 6 sorting and intervals
q(w=6, t='Merge intervals', lv=M, fn='merge_intervals', sig='def merge_intervals(intervals):',
  p='Merge all overlapping [start, end] intervals.',
  tests=[[[[[1, 3], [2, 6], [8, 10], [15, 18]]], [[1, 6], [8, 10], [15, 18]]], [[[[1, 4], [4, 5]]], [[1, 5]]]],
  h=['Sort by start.', 'If the next starts before the current ends, extend; else start a new one.', 'Touching intervals merge.', 'intervals.sort()\nout = []'],
  sol='def merge_intervals(intervals):\n    out = []\n    for s, e in sorted(intervals):\n        if out and s <= out[-1][1]:\n            out[-1][1] = max(out[-1][1], e)\n        else:\n            out.append([s, e])\n    return out', why='Merging validity windows is how SCD Type 2 histories are compacted.')
q(w=6, t='Insert interval', lv=M, fn='insert_interval', sig='def insert_interval(intervals, new):',
  p='intervals are sorted and do not overlap. Insert new and merge if needed.',
  tests=[[[[[1, 3], [6, 9]], [2, 5]], [[1, 5], [6, 9]]], [[[[1, 2], [3, 5], [6, 7], [8, 10], [12, 16]], [4, 8]], [[1, 2], [3, 10], [12, 16]]], [[[], [5, 7]], [[5, 7]]]],
  h=['Three phases: before, overlapping, after.', 'Grow the new interval while it overlaps.', 'Empty list.', 'out = []; i = 0'],
  sol='def insert_interval(intervals, new):\n    out, i, n = [], 0, len(intervals)\n    s, e = new\n    while i < n and intervals[i][1] < s:\n        out.append(intervals[i]); i += 1\n    while i < n and intervals[i][0] <= e:\n        s, e = min(s, intervals[i][0]), max(e, intervals[i][1]); i += 1\n    out.append([s, e])\n    return out + intervals[i:]', why='Late data arriving into an existing timeline.')
q(w=6, t='Meeting rooms', lv=E, fn='can_attend', sig='def can_attend(intervals):',
  p='Can one person attend every meeting? (no overlaps)',
  tests=[[[[[0, 30], [5, 10], [15, 20]]], False], [[[[7, 10], [2, 4]]], True]],
  h=['Overlap means a meeting starts before the previous ends.', 'Sort by start and compare neighbours.', 'Back-to-back is fine.', 'intervals.sort()'],
  sol='def can_attend(intervals):\n    intervals = sorted(intervals)\n    return all(intervals[i][0] >= intervals[i - 1][1] for i in range(1, len(intervals)))', why='Detecting overlapping runs of the same job in Airflow.')
q(w=6, t='Meeting rooms II', lv=M, fn='min_rooms', sig='def min_rooms(intervals):',
  p='Return the minimum number of rooms needed.',
  tests=[[[[[0, 30], [5, 10], [15, 20]]], 2], [[[[7, 10], [2, 4]]], 1], [[[[1, 5], [2, 6], [3, 7]]], 3]],
  h=['Rooms needed = max meetings running at the same time.', 'Sort starts and ends separately, or use a heap of end times.', 'An end at t frees a room for a start at t.', 'import heapq\nends = []'],
  sol='def min_rooms(intervals):\n    import heapq\n    ends = []\n    for s, e in sorted(intervals):\n        if ends and ends[0] <= s:\n            heapq.heapreplace(ends, e)\n        else:\n            heapq.heappush(ends, e)\n    return len(ends)', why='Peak concurrency sizes your cluster: how many executors at the busiest minute.')
q(w=6, t='Non-overlapping intervals', lv=M, fn='erase_overlap', sig='def erase_overlap(intervals):',
  p='Return the fewest intervals to remove so the rest do not overlap.',
  tests=[[[[[1, 2], [2, 3], [3, 4], [1, 3]]], 1], [[[[1, 2], [1, 2], [1, 2]]], 2], [[[[1, 2], [2, 3]]], 0]],
  h=['Keep as many as possible.', 'Greedy: sort by end, keep each that starts after the last kept end.', 'Touching is not overlapping.', 'intervals.sort(key=lambda x: x[1])'],
  sol="def erase_overlap(intervals):\n    end, kept = float('-inf'), 0\n    for s, e in sorted(intervals, key=lambda x: x[1]):\n        if s >= end:\n            kept += 1\n            end = e\n    return len(intervals) - kept", why='Greedy scheduling of batch windows.')
q(w=6, t='Sort colors', lv=M, fn='sort_colors', sig='def sort_colors(nums):',
  p='nums holds only 0, 1 and 2. Sort in place in one pass without sort().',
  tests=[[[[2, 0, 2, 1, 1, 0]], [0, 0, 1, 1, 2, 2]], [[[2, 0, 1]], [0, 1, 2]]], inplace=0,
  h=['Three regions: 0s, 1s, 2s.', 'Dutch flag: low, mid and high pointers.', 'Do not advance mid after swapping with high.', 'lo, mid, hi = 0, 0, len(nums) - 1'],
  sol='def sort_colors(nums):\n    lo, mid, hi = 0, 0, len(nums) - 1\n    while mid <= hi:\n        if nums[mid] == 0:\n            nums[lo], nums[mid] = nums[mid], nums[lo]; lo += 1; mid += 1\n        elif nums[mid] == 1:\n            mid += 1\n        else:\n            nums[mid], nums[hi] = nums[hi], nums[mid]; hi -= 1', why='Partitioning by a few keys in one pass, like bucketing rows by status.')
q(w=6, t='Largest number', lv=M, fn='largest_number', sig='def largest_number(nums):',
  p="Arrange the numbers to form the largest number. Return it as a string: [3, 30, 34, 5, 9] gives '9534330'.",
  tests=[[[[10, 2]], '210'], [[[3, 30, 34, 5, 9]], '9534330'], [[[0, 0]], '0']],
  h=['Compare two numbers by which concatenation is bigger.', 'Sort with a custom comparator: a+b vs b+a.', 'All zeros returns "0".', 'from functools import cmp_to_key'],
  sol="def largest_number(nums):\n    from functools import cmp_to_key\n    s = [str(x) for x in nums]\n    s.sort(key=cmp_to_key(lambda a, b: (b + a > a + b) - (b + a < a + b)))\n    out = ''.join(s)\n    return '0' if out[0] == '0' else out", why='Custom sort keys, like ordering by a business rule rather than a column.')

# Week 7 binary search
q(w=7, t='Binary search', lv=E, fn='search', sig='def search(nums, target):',
  p='nums is sorted. Return the index of target, or -1. O(log n).',
  tests=[[[[-1, 0, 3, 5, 9, 12], 9], 4], [[[-1, 0, 3, 5, 9, 12], 2], -1]],
  h=['Halve the search space each step.', 'lo, hi; compare the middle.', 'Loop while lo <= hi.', 'lo, hi = 0, len(nums) - 1'],
  sol='def search(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid - 1\n    return -1', big='(list(range(1000000)), 765432)', why='Min/max stats in Parquet footers let engines binary-search row groups.')
q(w=7, t='First bad version', lv=E, fn='first_bad', sig='def first_bad(n, bad):',
  p='Versions 1..n; every version from bad onward is broken. is_bad(v) = v >= bad. Find the first bad version with few checks.',
  tests=[[[5, 4], 4], [[1, 1], 1], [[100, 37], 37]],
  h=['Find the boundary between good and bad.', 'Binary search for the first True.', 'Use lo < hi and set hi = mid on bad.', 'is_bad = lambda v: v >= bad'],
  sol='def first_bad(n, bad):\n    is_bad = lambda v: v >= bad\n    lo, hi = 1, n\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if is_bad(mid):\n            hi = mid\n        else:\n            lo = mid + 1\n    return lo', why='git bisect on a broken pipeline: which commit changed the numbers?')
q(w=7, t='Search insert position', lv=E, fn='search_insert', sig='def search_insert(nums, target):',
  p='Return the index of target, or where it would be inserted to keep order.',
  tests=[[[[1, 3, 5, 6], 5], 2], [[[1, 3, 5, 6], 2], 1], [[[1, 3, 5, 6], 7], 4]],
  h=['The first index with nums[i] >= target.', 'Lower-bound binary search.', 'Can be len(nums).', 'lo, hi = 0, len(nums)'],
  sol='def search_insert(nums, target):\n    lo, hi = 0, len(nums)\n    while lo < hi:\n        mid = (lo + hi) // 2\n        if nums[mid] < target:\n            lo = mid + 1\n        else:\n            hi = mid\n    return lo', why='Finding which sorted file a key belongs to.')
q(w=7, t='First and last position', lv=M, fn='search_range', sig='def search_range(nums, target):',
  p='nums is sorted. Return [first, last] index of target, or [-1, -1].',
  tests=[[[[5, 7, 7, 8, 8, 10], 8], [3, 4]], [[[5, 7, 7, 8, 8, 10], 6], [-1, -1]], [[[], 0], [-1, -1]]],
  h=['Two lower-bound searches.', 'First = lower_bound(target); last = lower_bound(target + 1) - 1.', 'Check the value exists.', 'def lb(x): ...'],
  sol='def search_range(nums, target):\n    def lb(x):\n        lo, hi = 0, len(nums)\n        while lo < hi:\n            mid = (lo + hi) // 2\n            if nums[mid] < x:\n                lo = mid + 1\n            else:\n                hi = mid\n        return lo\n    a = lb(target)\n    if a == len(nums) or nums[a] != target:\n        return [-1, -1]\n    return [a, lb(target + 1) - 1]', why='Range lookups on a sorted key: how clustering speeds up BETWEEN.')
q(w=7, t='Search rotated sorted array', lv=M, fn='search_rotated', sig='def search_rotated(nums, target):',
  p='A sorted array was rotated (e.g. [4,5,6,7,0,1,2]). Return the index of target or -1 in O(log n).',
  tests=[[[[4, 5, 6, 7, 0, 1, 2], 0], 4], [[[4, 5, 6, 7, 0, 1, 2], 3], -1], [[[1], 0], -1]],
  h=['One half around mid is always sorted.', 'Check if target is inside the sorted half; else search the other.', 'Use <= on comparisons with nums[lo].', 'while lo <= hi:\n    mid = ...\n    if nums[lo] <= nums[mid]: # left half sorted'],
  sol='def search_rotated(nums, target):\n    lo, hi = 0, len(nums) - 1\n    while lo <= hi:\n        mid = (lo + hi) // 2\n        if nums[mid] == target:\n            return mid\n        if nums[lo] <= nums[mid]:\n            if nums[lo] <= target < nums[mid]:\n                hi = mid - 1\n            else:\n                lo = mid + 1\n        else:\n            if nums[mid] < target <= nums[hi]:\n                lo = mid + 1\n            else:\n                hi = mid - 1\n    return -1', why='Reasoning about which half is ordered, like partitions that wrap at midnight.')
q(w=7, t='Koko eating bananas', lv=M, fn='min_eating_speed', sig='def min_eating_speed(piles, h):',
  p='Each hour Koko eats up to k bananas from one pile. Return the smallest k that finishes all piles within h hours.',
  tests=[[[[3, 6, 7, 11], 8], 4], [[[30, 11, 23, 4, 20], 5], 30], [[[30, 11, 23, 4, 20], 6], 23]],
  h=['Binary search on the answer, not the array.', 'For a speed k, hours = sum(ceil(p / k)).', 'Search between 1 and max(piles).', 'lo, hi = 1, max(piles)'],
  sol='def min_eating_speed(piles, h):\n    lo, hi = 1, max(piles)\n    while lo < hi:\n        k = (lo + hi) // 2\n        if sum((p + k - 1) // k for p in piles) <= h:\n            hi = k\n        else:\n            lo = k + 1\n    return lo', why='Capacity planning: the smallest cluster that meets the SLA.')
q(w=7, t='Time-based key-value store', lv=M, fn='TimeMap', sig='class TimeMap:\n    def __init__(self):\n        pass\n    def set(self, key, value, timestamp):\n        pass\n    def get(self, key, timestamp):\n        pass', cls=True,
  p='set stores a value at a time; get returns the value with the largest timestamp <= the given one, or "".',
  tests=[[[['TimeMap', 'set', 'get', 'get', 'set', 'get', 'get'], [[], ['foo', 'bar', 1], ['foo', 1], ['foo', 3], ['foo', 'bar2', 4], ['foo', 4], ['foo', 5]]], [None, None, 'bar', 'bar', None, 'bar2', 'bar2']]],
  h=['Timestamps arrive in increasing order per key.', 'Store a list per key and binary search it.', 'Before the first timestamp return "".', 'import bisect'],
  sol="class TimeMap:\n    def __init__(self):\n        self.d = {}\n    def set(self, key, value, timestamp):\n        self.d.setdefault(key, []).append((timestamp, value))\n    def get(self, key, timestamp):\n        import bisect\n        a = self.d.get(key, [])\n        i = bisect.bisect_right(a, (timestamp, chr(0x10FFFF)))\n        return a[i - 1][1] if i else ''", why='An as-of join: the value valid at a point in time, like Iceberg time travel.')

# Week 8 heaps and top-K
q(w=8, t='Kth largest in a stream', lv=E, fn='KthLargest', sig='class KthLargest:\n    def __init__(self, k, nums):\n        pass\n    def add(self, val):\n        pass', cls=True,
  p='After each add, return the kth largest value seen so far.',
  tests=[[[['KthLargest', 'add', 'add', 'add', 'add', 'add'], [[3, [4, 5, 8, 2]], [3], [5], [10], [9], [4]]], [None, 4, 5, 5, 8, 8]]],
  h=['You only need the k largest values.', 'A min-heap of size k; its top is the answer.', 'Start with fewer than k values.', 'import heapq'],
  sol='class KthLargest:\n    def __init__(self, k, nums):\n        import heapq\n        self.k, self.h = k, []\n        for x in nums:\n            self.add(x)\n    def add(self, val):\n        import heapq\n        heapq.heappush(self.h, val)\n        if len(self.h) > self.k:\n            heapq.heappop(self.h)\n        return self.h[0]', why='A streaming top-K with bounded memory.')
q(w=8, t='Last stone weight', lv=E, fn='last_stone_weight', sig='def last_stone_weight(stones):',
  p='Smash the two heaviest stones: equal, both vanish; else the difference remains. Return the last weight or 0.',
  tests=[[[[2, 7, 4, 1, 8, 1]], 1], [[[1]], 1], [[[2, 2]], 0]],
  h=['Always take the two biggest.', 'Python has a min-heap: push negatives.', 'Empty at the end returns 0.', 'h = [-s for s in stones]; heapq.heapify(h)'],
  sol='def last_stone_weight(stones):\n    import heapq\n    h = [-s for s in stones]\n    heapq.heapify(h)\n    while len(h) > 1:\n        a, b = -heapq.heappop(h), -heapq.heappop(h)\n        if a != b:\n            heapq.heappush(h, -(a - b))\n    return -h[0] if h else 0', why='Repeatedly merging the biggest pieces is how compaction picks files.')
q(w=8, t='K closest points to origin', lv=M, fn='k_closest', sig='def k_closest(points, k):',
  p='Return the k points closest to (0, 0), any order.',
  tests=[[[[[1, 3], [-2, 2]], 1], [[-2, 2]]], [[[[3, 3], [5, -1], [-2, 4]], 2], [[3, 3], [-2, 4]]]], un=True,
  h=['Distance squared is enough.', 'heapq.nsmallest(k, points, key=...).', 'Ties: any order.', 'key=lambda p: p[0]**2 + p[1]**2'],
  sol='def k_closest(points, k):\n    import heapq\n    return heapq.nsmallest(k, points, key=lambda p: p[0] * p[0] + p[1] * p[1])', why='Nearest-neighbour search, the core of vector retrieval in RAG.')
q(w=8, t='Top K frequent words', lv=M, fn='top_k_words', sig='def top_k_words(words, k):',
  p='Return the k most frequent words, by count high to low, ties alphabetical.',
  tests=[[[['i', 'love', 'leetcode', 'i', 'love', 'coding'], 2], ['i', 'love']], [[['the', 'day', 'is', 'sunny', 'the', 'the', 'the', 'sunny', 'is', 'is'], 4], ['the', 'is', 'sunny', 'day']]],
  h=['Count, then sort by (-count, word).', 'Sorting key handles both rules at once.', 'Ties go alphabetical.', 'from collections import Counter'],
  sol='def top_k_words(words, k):\n    from collections import Counter\n    c = Counter(words)\n    return sorted(c, key=lambda w: (-c[w], w))[:k]', why='ORDER BY count DESC, name ASC LIMIT k.')
q(w=8, t='Merge K sorted lists', lv=H, fn='merge_k', sig='def merge_k(lists):',
  p='Merge k sorted lists of numbers into one sorted list.',
  tests=[[[[[1, 4, 5], [1, 3, 4], [2, 6]]], [1, 1, 2, 3, 4, 4, 5, 6]], [[[]], []], [[[[]]], []]],
  h=['Always take the smallest head among k lists.', 'A heap of (value, list index, position).', 'Empty lists.', 'import heapq\nh = [(l[0], i, 0) for i, l in enumerate(lists) if l]'],
  sol='def merge_k(lists):\n    import heapq\n    h = [(l[0], i, 0) for i, l in enumerate(lists) if l]\n    heapq.heapify(h)\n    out = []\n    while h:\n        v, i, j = heapq.heappop(h)\n        out.append(v)\n        if j + 1 < len(lists[i]):\n            heapq.heappush(h, (lists[i][j + 1], i, j + 1))\n    return out', why='k-way merge is how external sort and LSM compaction work.')
q(w=8, t='Task scheduler', lv=M, fn='least_interval', sig='def least_interval(tasks, n):',
  p='Same tasks must be n slots apart. Return the fewest slots (idle allowed) to run all tasks.',
  tests=[[[['A', 'A', 'A', 'B', 'B', 'B'], 2], 8], [[['A', 'A', 'A', 'B', 'B', 'B'], 0], 6], [[['A', 'A', 'A', 'A', 'A', 'A', 'B', 'C', 'D', 'E', 'F', 'G'], 2], 16]],
  h=['The most frequent task sets the frame.', 'Frame = (maxcount - 1) * (n + 1) + number of tasks with maxcount.', 'Answer is at least len(tasks).', 'from collections import Counter'],
  sol='def least_interval(tasks, n):\n    from collections import Counter\n    c = Counter(tasks).values()\n    m = max(c)\n    top = sum(1 for x in c if x == m)\n    return max(len(tasks), (m - 1) * (n + 1) + top)', why='Scheduling with cooldowns, like API rate limits on an LLM step.')
q(w=8, t='Median from a data stream', lv=H, fn='MedianFinder', sig='class MedianFinder:\n    def __init__(self):\n        pass\n    def addNum(self, num):\n        pass\n    def findMedian(self):\n        pass', cls=True,
  p='Support addNum and findMedian efficiently.',
  tests=[[[['MedianFinder', 'addNum', 'addNum', 'findMedian', 'addNum', 'findMedian'], [[], [1], [2], [], [3], []]], [None, None, None, 1.5, None, 2.0]]],
  h=['Split numbers into a low half and a high half.', 'Max-heap for the low half, min-heap for the high half; keep sizes balanced.', 'Odd count: median is the top of the bigger heap.', 'self.lo, self.hi = [], []  # lo stores negatives'],
  sol='class MedianFinder:\n    def __init__(self):\n        self.lo, self.hi = [], []\n    def addNum(self, num):\n        import heapq\n        heapq.heappush(self.lo, -num)\n        heapq.heappush(self.hi, -heapq.heappop(self.lo))\n        if len(self.hi) > len(self.lo):\n            heapq.heappush(self.lo, -heapq.heappop(self.hi))\n    def findMedian(self):\n        if len(self.lo) > len(self.hi):\n            return float(-self.lo[0])\n        return (-self.lo[0] + self.hi[0]) / 2', why='Streaming percentiles for latency dashboards.')

# Week 9 linked lists and LRU
q(w=9, t='Reverse linked list', lv=E, fn='reverse_list', sig='def reverse_list(head):\n    # head is a ListNode (val, next) or None', **{'in': ['list']}, out='list',
  p='Reverse a singly linked list and return the new head.',
  tests=[[[[1, 2, 3, 4, 5]], [5, 4, 3, 2, 1]], [[[]], []]],
  h=['Point each node back at the previous one.', 'Three variables: prev, cur, next.', 'Empty list returns None.', 'prev = None\nwhile head:\n    nxt = head.next'],
  sol='def reverse_list(head):\n    prev = None\n    while head:\n        nxt = head.next\n        head.next = prev\n        prev, head = head, nxt\n    return prev', why='Pointer thinking you need for any log-structured storage.')
q(w=9, t='Merge two sorted lists', lv=E, fn='merge_two', sig='def merge_two(a, b):', **{'in': ['list', 'list']}, out='list',
  p='Merge two sorted linked lists into one sorted list.',
  tests=[[[[1, 2, 4], [1, 3, 4]], [1, 1, 2, 3, 4, 4]], [[[], []], []], [[[], [0]], [0]]],
  h=['Take the smaller head each time.', 'A dummy node makes the start easy.', 'Attach the leftover list at the end.', 'dummy = tail = ListNode()'],
  sol='def merge_two(a, b):\n    dummy = tail = ListNode()\n    while a and b:\n        if a.val <= b.val:\n            tail.next, a = a, a.next\n        else:\n            tail.next, b = b, b.next\n        tail = tail.next\n    tail.next = a or b\n    return dummy.next', why='The merge step of a sort-merge join.')
q(w=9, t='Linked list cycle', lv=E, fn='has_cycle', sig='def has_cycle(head):', **{'in': ['cycle']},
  p='Return True if the list loops back on itself.',
  tests=[[[[[3, 2, 0, -4], 1]], True], [[[[1, 2], 0]], True], [[[[1], -1]], False]],
  h=['Two runners at different speeds meet if there is a loop.', 'slow moves 1, fast moves 2.', 'fast reaching None means no loop.', 'slow = fast = head'],
  sol='def has_cycle(head):\n    slow = fast = head\n    while fast and fast.next:\n        slow, fast = slow.next, fast.next.next\n        if slow is fast:\n            return True\n    return False', why='Cycle detection is how Airflow rejects a DAG that loops.')
q(w=9, t='Remove Nth node from end', lv=M, fn='remove_nth', sig='def remove_nth(head, n):', **{'in': ['list']}, out='list',
  p='Remove the nth node from the end and return the head.',
  tests=[[[[1, 2, 3, 4, 5], 2], [1, 2, 3, 5]], [[[1], 1], []], [[[1, 2], 1], [1]]],
  h=['Keep two pointers n apart.', 'When the front one hits the end, the back one is just before the target.', 'Removing the head: use a dummy node.', 'dummy = ListNode(0, head)'],
  sol='def remove_nth(head, n):\n    dummy = ListNode(0, head)\n    fast = slow = dummy\n    for _ in range(n):\n        fast = fast.next\n    while fast.next:\n        fast, slow = fast.next, slow.next\n    slow.next = slow.next.next\n    return dummy.next', why='Offsets from the end, like reading the last N records of a log.')
q(w=9, t='Reorder list', lv=M, fn='reorder', sig='def reorder(head):\n    # change the list in place; return head', **{'in': ['list']}, out='list',
  p='L0 → Ln → L1 → Ln-1 → ... in place.',
  tests=[[[[1, 2, 3, 4]], [1, 4, 2, 3]], [[[1, 2, 3, 4, 5]], [1, 5, 2, 4, 3]]],
  h=['Three steps you already know.', 'Find the middle, reverse the second half, weave the two halves.', 'Odd length leaves the middle at the end.', 'slow, fast = head, head.next'],
  sol='def reorder(head):\n    if not head:\n        return head\n    slow, fast = head, head.next\n    while fast and fast.next:\n        slow, fast = slow.next, fast.next.next\n    second, slow.next = slow.next, None\n    prev = None\n    while second:\n        nxt = second.next\n        second.next = prev\n        prev, second = second, nxt\n    a, b = head, prev\n    while b:\n        an, bn = a.next, b.next\n        a.next, b.next = b, an\n        a, b = an, bn\n    return head', why='Combining small known steps is how you answer a design round too.')
q(w=9, t='Add two numbers', lv=M, fn='add_two', sig='def add_two(a, b):', **{'in': ['list', 'list']}, out='list',
  p='Digits are stored in reverse order (2→4→3 is 342). Return the sum as a list in the same format.',
  tests=[[[[2, 4, 3], [5, 6, 4]], [7, 0, 8]], [[[0], [0]], [0]], [[[9, 9, 9], [1]], [0, 0, 0, 1]]],
  h=['Add digit by digit with a carry.', 'Keep going while either list or the carry remains.', 'A final carry adds a node.', 'dummy = tail = ListNode(); carry = 0'],
  sol='def add_two(a, b):\n    dummy = tail = ListNode()\n    carry = 0\n    while a or b or carry:\n        s = carry + (a.val if a else 0) + (b.val if b else 0)\n        carry, d = divmod(s, 10)\n        tail.next = ListNode(d)\n        tail = tail.next\n        a = a.next if a else None\n        b = b.next if b else None\n    return dummy.next', why='Carry state across chunks, like stateful stream processing.')
q(w=9, t='LRU cache', lv=M, fn='LRUCache', sig='class LRUCache:\n    def __init__(self, capacity):\n        pass\n    def get(self, key):\n        pass\n    def put(self, key, value):\n        pass', cls=True,
  p='get returns the value or -1; put inserts and evicts the least recently used key when full. Both O(1).',
  tests=[[[['LRUCache', 'put', 'put', 'get', 'put', 'get', 'put', 'get', 'get', 'get'], [[2], [1, 1], [2, 2], [1], [3, 3], [2], [4, 4], [1], [3], [4]]], [None, None, None, 1, None, -1, None, -1, 3, 4]]],
  h=['You need fast lookup and fast "move to most recent".', 'OrderedDict gives both (or a dict plus a doubly linked list).', 'get also counts as use.', 'from collections import OrderedDict'],
  sol='class LRUCache:\n    def __init__(self, capacity):\n        from collections import OrderedDict\n        self.c, self.d = capacity, OrderedDict()\n    def get(self, key):\n        if key not in self.d:\n            return -1\n        self.d.move_to_end(key)\n        return self.d[key]\n    def put(self, key, value):\n        self.d[key] = value\n        self.d.move_to_end(key)\n        if len(self.d) > self.c:\n            self.d.popitem(last=False)', why='Spark and every query engine evict cached blocks this way.')

# Week 10 trees
q(w=10, t='Maximum depth of binary tree', lv=E, fn='max_depth', sig='def max_depth(root):\n    # root is a TreeNode (val, left, right) or None', **{'in': ['tree']},
  p='Return the number of levels in the tree.',
  tests=[[[[3, 9, 20, None, None, 15, 7]], 3], [[[1, None, 2]], 2], [[[]], 0]],
  h=['Depth = 1 + deeper of the two children.', 'Recursion or BFS by level.', 'None has depth 0.', 'if not root: return 0'],
  sol='def max_depth(root):\n    if not root:\n        return 0\n    return 1 + max(max_depth(root.left), max_depth(root.right))', why='DAG depth decides the critical path of your pipeline.')
q(w=10, t='Invert binary tree', lv=E, fn='invert_tree', sig='def invert_tree(root):', **{'in': ['tree']}, out='tree',
  p='Mirror the tree and return the root.',
  tests=[[[[4, 2, 7, 1, 3, 6, 9]], [4, 7, 2, 9, 6, 3, 1]], [[[]], []]],
  h=['Swap left and right at every node.', 'Recursion, or a stack.', 'None stays None.', 'root.left, root.right = root.right, root.left'],
  sol='def invert_tree(root):\n    if root:\n        root.left, root.right = invert_tree(root.right), invert_tree(root.left)\n    return root', why='Tree rewrites are what query optimisers do to plans.')
q(w=10, t='Level order traversal', lv=M, fn='level_order', sig='def level_order(root):', **{'in': ['tree']},
  p='Return values level by level, as a list of lists.',
  tests=[[[[3, 9, 20, None, None, 15, 7]], [[3], [9, 20], [15, 7]]], [[[1]], [[1]]], [[[]], []]],
  h=['Visit by distance from the root.', 'BFS with a queue, one level at a time.', 'Empty tree returns [].', 'from collections import deque'],
  sol='def level_order(root):\n    from collections import deque\n    if not root:\n        return []\n    out, q = [], deque([root])\n    while q:\n        lvl = []\n        for _ in range(len(q)):\n            n = q.popleft()\n            lvl.append(n.val)\n            q.extend(c for c in (n.left, n.right) if c)\n        out.append(lvl)\n    return out', why='Running a DAG wave by wave: everything whose parents are done.')
q(w=10, t='Validate binary search tree', lv=M, fn='is_valid_bst', sig='def is_valid_bst(root):', **{'in': ['tree']},
  p='Is every left subtree smaller and every right subtree larger than its node?',
  tests=[[[[2, 1, 3]], True], [[[5, 1, 4, None, None, 3, 6]], False], [[[5, 4, 6, None, None, 3, 7]], False]],
  h=['Checking only direct children is not enough.', 'Pass down the allowed (low, high) range.', 'Values equal to a bound are invalid.', 'def ok(n, lo, hi): ...'],
  sol="def is_valid_bst(root):\n    def ok(n, lo, hi):\n        if not n:\n            return True\n        if not (lo < n.val < hi):\n            return False\n        return ok(n.left, lo, n.val) and ok(n.right, n.val, hi)\n    return ok(root, float('-inf'), float('inf'))", why='Range constraints flowing down, like min/max stats in an index.')
q(w=10, t='Lowest common ancestor (BST)', lv=M, fn='lca', sig='def lca(root, p, q):\n    # p and q are TreeNodes in the tree', lca=True, out='val',
  p='In a BST, return the lowest node that has both p and q as descendants.',
  tests=[[[[6, 2, 8, 0, 4, 7, 9, None, None, 3, 5], 2, 8], 6], [[[6, 2, 8, 0, 4, 7, 9, None, None, 3, 5], 2, 4], 2]],
  h=['BST order tells you which way to go.', 'Both smaller: go left. Both larger: go right. Otherwise you are there.', 'A node can be its own ancestor.', 'while root: ...'],
  sol='def lca(root, p, q):\n    while root:\n        if p.val < root.val and q.val < root.val:\n            root = root.left\n        elif p.val > root.val and q.val > root.val:\n            root = root.right\n        else:\n            return root', why='Finding the common upstream table of two broken dashboards.')
q(w=10, t='Right side view', lv=M, fn='right_side_view', sig='def right_side_view(root):', **{'in': ['tree']},
  p='Return the values you would see looking at the tree from the right, top to bottom.',
  tests=[[[[1, 2, 3, None, 5, None, 4]], [1, 3, 4]], [[[1, None, 3]], [1, 3]], [[[]], []]],
  h=['The last node of each level.', 'BFS by level, keep the last value.', 'Empty tree.', 'from collections import deque'],
  sol='def right_side_view(root):\n    from collections import deque\n    if not root:\n        return []\n    out, q = [], deque([root])\n    while q:\n        for i in range(len(q)):\n            n = q.popleft()\n            if i == 0:\n                out.append(n.val)\n            q.extend(c for c in (n.right, n.left) if c)\n    return out', why='Per-group "last value" is LAST_VALUE() OVER (PARTITION BY level).')
q(w=10, t='Kth smallest in a BST', lv=M, fn='kth_smallest', sig='def kth_smallest(root, k):', **{'in': ['tree']},
  p='Return the kth smallest value (1-based).',
  tests=[[[[3, 1, 4, None, 2], 1], 1], [[[5, 3, 6, 2, 4, None, None, 1], 3], 3]],
  h=['In-order traversal of a BST visits values in sorted order.', 'Iterative in-order with a stack; stop at k.', 'k is 1-based.', 'st = []; cur = root'],
  sol='def kth_smallest(root, k):\n    st, cur = [], root\n    while st or cur:\n        while cur:\n            st.append(cur)\n            cur = cur.left\n        cur = st.pop()\n        k -= 1\n        if k == 0:\n            return cur.val\n        cur = cur.right', why='Ordered iteration without sorting: what a B-tree index gives a warehouse.')

# Week 11 graphs
q(w=11, t='Flood fill', lv=E, fn='flood_fill', sig='def flood_fill(image, sr, sc, color):',
  p='Recolor the connected area of the same color that contains (sr, sc), 4-directionally.',
  tests=[[[[[1, 1, 1], [1, 1, 0], [1, 0, 1]], 1, 1, 2], [[2, 2, 2], [2, 2, 0], [2, 0, 1]]], [[[[0, 0, 0], [0, 0, 0]], 0, 0, 0], [[0, 0, 0], [0, 0, 0]]]],
  h=['Spread to neighbours with the same original color.', 'DFS or BFS from the start cell.', 'If the new color equals the old one, stop at once.', 'old = image[sr][sc]'],
  sol='def flood_fill(image, sr, sc, color):\n    old = image[sr][sc]\n    if old == color:\n        return image\n    st = [(sr, sc)]\n    while st:\n        r, c = st.pop()\n        if 0 <= r < len(image) and 0 <= c < len(image[0]) and image[r][c] == old:\n            image[r][c] = color\n            st += [(r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)]\n    return image', why='Propagating a change to everything connected: impact analysis in lineage.')
q(w=11, t='Number of islands', lv=M, fn='num_islands', sig='def num_islands(grid):',
  p="Count groups of '1' cells connected up/down/left/right.",
  tests=[[[[['1', '1', '0', '0'], ['1', '1', '0', '0'], ['0', '0', '1', '0'], ['0', '0', '0', '1']]], 3], [[[['0']]], 0]],
  h=['Each unvisited land cell starts a new island.', 'Sink the whole island with DFS/BFS so you do not count it twice.', 'Grid edges.', 'for r in range(R):\n    for c in range(C):\n        if grid[r][c] == "1": count += 1; sink(r, c)'],
  sol="def num_islands(grid):\n    R, C, n = len(grid), len(grid[0]), 0\n    for r in range(R):\n        for c in range(C):\n            if grid[r][c] == '1':\n                n += 1\n                st = [(r, c)]\n                while st:\n                    i, j = st.pop()\n                    if 0 <= i < R and 0 <= j < C and grid[i][j] == '1':\n                        grid[i][j] = '0'\n                        st += [(i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)]\n    return n", why='Connected components, like grouping devices into one household (identity resolution).')
q(w=11, t='Clone graph (adjacency list)', lv=M, fn='clone_graph', sig='def clone_graph(adj):\n    # adj: {node: [neighbours]} as a dict of lists',
  p='Return a deep copy of the adjacency dict: new lists, same structure.',
  tests=[[[{'1': ['2', '4'], '2': ['1', '3'], '3': ['2', '4'], '4': ['1', '3']}], {'1': ['2', '4'], '2': ['1', '3'], '3': ['2', '4'], '4': ['1', '3']}], [[{}], {}]],
  h=['Visit every node once.', 'BFS from any node, copying neighbour lists.', 'Disconnected nodes still need copying.', 'out = {}\nfor node in adj: ...'],
  sol='def clone_graph(adj):\n    return {k: list(v) for k, v in adj.items()}', why='Copying a DAG definition before editing it safely.')
q(w=11, t='Course schedule', lv=M, fn='can_finish', sig='def can_finish(n, prereqs):',
  p='n courses, prereqs [a, b] means b before a. Can you finish all?',
  tests=[[[2, [[1, 0]]], True], [[2, [[1, 0], [0, 1]]], False], [[3, [[1, 0], [2, 1]]], True]],
  h=['Impossible exactly when there is a cycle.', 'Kahn: repeatedly take courses with no remaining prerequisites.', 'Count how many you took.', 'indeg = [0] * n; graph = [[] for _ in range(n)]'],
  sol='def can_finish(n, prereqs):\n    from collections import deque\n    g, indeg = [[] for _ in range(n)], [0] * n\n    for a, b in prereqs:\n        g[b].append(a)\n        indeg[a] += 1\n    q = deque(i for i in range(n) if indeg[i] == 0)\n    done = 0\n    while q:\n        x = q.popleft()\n        done += 1\n        for y in g[x]:\n            indeg[y] -= 1\n            if indeg[y] == 0:\n                q.append(y)\n    return done == n', why='This is literally how Airflow and dbt validate a DAG.')
q(w=11, t='Course schedule II', lv=M, fn='find_order', sig='def find_order(n, prereqs):',
  p='Return one valid order of all courses, or [] if impossible.',
  tests=[[[2, [[1, 0]]], [0, 1]], [[1, []], [0]], [[2, [[1, 0], [0, 1]]], []]],
  h=['Same as Course schedule, but record the order.', 'Topological sort with Kahn.', 'Cycle returns [].', 'order = []'],
  sol='def find_order(n, prereqs):\n    from collections import deque\n    g, indeg = [[] for _ in range(n)], [0] * n\n    for a, b in prereqs:\n        g[b].append(a)\n        indeg[a] += 1\n    q = deque(i for i in range(n) if indeg[i] == 0)\n    out = []\n    while q:\n        x = q.popleft()\n        out.append(x)\n        for y in g[x]:\n            indeg[y] -= 1\n            if indeg[y] == 0:\n                q.append(y)\n    return out if len(out) == n else []', why='The run order your scheduler computes for a DAG.')
q(w=11, t='Rotting oranges', lv=M, fn='oranges_rotting', sig='def oranges_rotting(grid):',
  p='Each minute, rotten (2) oranges rot fresh (1) neighbours. Return minutes until none are fresh, or -1.',
  tests=[[[[[2, 1, 1], [1, 1, 0], [0, 1, 1]]], 4], [[[[2, 1, 1], [0, 1, 1], [1, 0, 1]]], -1], [[[[0, 2]]], 0]],
  h=['Spread from all rotten oranges at once.', 'Multi-source BFS, one ring per minute.', 'Fresh left over means -1.', 'from collections import deque'],
  sol='def oranges_rotting(grid):\n    from collections import deque\n    R, C = len(grid), len(grid[0])\n    q = deque((r, c) for r in range(R) for c in range(C) if grid[r][c] == 2)\n    fresh = sum(row.count(1) for row in grid)\n    t = 0\n    while q and fresh:\n        for _ in range(len(q)):\n            r, c = q.popleft()\n            for i, j in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):\n                if 0 <= i < R and 0 <= j < C and grid[i][j] == 1:\n                    grid[i][j] = 2\n                    fresh -= 1\n                    q.append((i, j))\n        t += 1\n    return -1 if fresh else t', why='How a failure spreads downstream minute by minute: blast radius.')
q(w=11, t='Network delay time', lv=M, fn='network_delay', sig='def network_delay(times, n, k):',
  p='times[i] = [u, v, w]. A signal starts at node k. Return the time for all n nodes to receive it, or -1.',
  tests=[[[[[2, 1, 1], [2, 3, 1], [3, 4, 1]], 4, 2], 2], [[[[1, 2, 1]], 2, 1], 1], [[[[1, 2, 1]], 2, 2], -1]],
  h=['Shortest path from one source with weights.', 'Dijkstra with a heap.', 'Unreached nodes mean -1.', 'import heapq\ndist = {}'],
  sol='def network_delay(times, n, k):\n    import heapq\n    g = {}\n    for u, v, w in times:\n        g.setdefault(u, []).append((v, w))\n    dist, h = {}, [(0, k)]\n    while h:\n        d, u = heapq.heappop(h)\n        if u in dist:\n            continue\n        dist[u] = d\n        for v, w in g.get(u, []):\n            if v not in dist:\n                heapq.heappush(h, (d + w, v))\n    return max(dist.values()) if len(dist) == n else -1', why='Critical path: when will the last downstream table be fresh?')

# Week 12 dynamic programming
q(w=12, t='Climbing stairs', lv=E, fn='climb_stairs', sig='def climb_stairs(n):',
  p='You can climb 1 or 2 steps. How many ways to reach step n?',
  tests=[[[2], 2], [[3], 3], [[10], 89]],
  h=['Ways(n) = ways(n-1) + ways(n-2).', 'Keep only the last two values.', 'n = 1 is 1 way.', 'a, b = 1, 1'],
  sol='def climb_stairs(n):\n    a, b = 1, 1\n    for _ in range(n):\n        a, b = b, a + b\n    return a', big='(5000,)', bigLabel='n = 5,000', why='Building answers from smaller answers is incremental processing.')
q(w=12, t='House robber', lv=M, fn='rob', sig='def rob(nums):',
  p='Take money from houses but never two neighbours. Return the most money.',
  tests=[[[[1, 2, 3, 1]], 4], [[[2, 7, 9, 3, 1]], 12], [[[]], 0]],
  h=['At each house: take it (plus best two back) or skip it.', 'best = max(prev, prev2 + x).', 'Empty list.', 'prev2 = prev = 0'],
  sol='def rob(nums):\n    prev2 = prev = 0\n    for x in nums:\n        prev2, prev = prev, max(prev, prev2 + x)\n    return prev', why='Choose-or-skip DP, like picking which partitions to backfill under a budget.')
q(w=12, t='Coin change', lv=M, fn='coin_change', sig='def coin_change(coins, amount):',
  p='Fewest coins that make amount, or -1.',
  tests=[[[[1, 2, 5], 11], 3], [[[2], 3], -1], [[[1], 0], 0]],
  h=['Best for amount a = 1 + best for (a - coin).', 'Fill a table from 0 up to amount.', 'Unreachable stays infinite.', 'dp = [0] + [inf] * amount'],
  sol="def coin_change(coins, amount):\n    INF = float('inf')\n    dp = [0] + [INF] * amount\n    for a in range(1, amount + 1):\n        for c in coins:\n            if c <= a and dp[a - c] + 1 < dp[a]:\n                dp[a] = dp[a - c] + 1\n    return -1 if dp[amount] == INF else dp[amount]", why='Minimum cost to reach a target, like the cheapest set of instance types.')
q(w=12, t='Longest increasing subsequence', lv=M, fn='length_of_lis', sig='def length_of_lis(nums):',
  p='Return the length of the longest strictly increasing subsequence.',
  tests=[[[[10, 9, 2, 5, 3, 7, 101, 18]], 4], [[[0, 1, 0, 3, 2, 3]], 4], [[[7, 7, 7]], 1]],
  h=['O(n²): best ending at i = 1 + best of smaller earlier items.', 'O(n log n): keep the smallest tail for each length and binary search.', 'Strictly increasing: equal values do not extend.', 'import bisect\ntails = []'],
  sol='def length_of_lis(nums):\n    import bisect\n    tails = []\n    for x in nums:\n        i = bisect.bisect_left(tails, x)\n        if i == len(tails):\n            tails.append(x)\n        else:\n            tails[i] = x\n    return len(tails)', why='Patience sorting, a classic trick behind efficient merges.')
q(w=12, t='Word break', lv=M, fn='word_break', sig='def word_break(s, words):',
  p='Can s be split into a sequence of words from the list?',
  tests=[[['leetcode', ['leet', 'code']], True], [['applepenapple', ['apple', 'pen']], True], [['catsandog', ['cats', 'dog', 'sand', 'and', 'cat']], False]],
  h=['ok[i] = some word ends at i and ok[start of that word] is True.', 'Use a set of words.', 'ok[0] is True.', 'ok = [True] + [False] * len(s)'],
  sol='def word_break(s, words):\n    ws = set(words)\n    ok = [True] + [False] * len(s)\n    for i in range(1, len(s) + 1):\n        ok[i] = any(ok[j] and s[j:i] in ws for j in range(i))\n    return ok[-1]', why='Tokenising text against a dictionary, like matching SKU codes.')
q(w=12, t='Unique paths', lv=M, fn='unique_paths', sig='def unique_paths(m, n):',
  p='A robot moves only right or down on an m x n grid. How many paths from top-left to bottom-right?',
  tests=[[[3, 7], 28], [[3, 2], 3], [[1, 1], 1]],
  h=['Paths to a cell = paths from above + from the left.', 'One row of the table is enough.', 'First row and column are all 1.', 'row = [1] * n'],
  sol='def unique_paths(m, n):\n    row = [1] * n\n    for _ in range(1, m):\n        for j in range(1, n):\n            row[j] += row[j - 1]\n    return row[-1]', why='Counting combinations is the first step in estimating a design.')
q(w=12, t='Mixed review: subarray sum equals K', lv=M, fn='subarray_sum', sig='def subarray_sum(nums, k):',
  p='Count contiguous subarrays whose sum is exactly k (numbers can be negative).',
  tests=[[[[1, 1, 1], 2], 2], [[[1, 2, 3], 3], 2], [[[1, -1, 0], 0], 3]],
  h=['A sum from i to j = prefix[j] - prefix[i].', 'Count prefix sums seen so far in a hash map.', 'Start with {0: 1}.', 'seen = {0: 1}; s = 0'],
  sol='def subarray_sum(nums, k):\n    seen, s, n = {0: 1}, 0, 0\n    for x in nums:\n        s += x\n        n += seen.get(s - k, 0)\n        seen[s] = seen.get(s, 0) + 1\n    return n', big='([1] * 100000, 50)', why='Prefix sums plus a hash map: hash join meets running totals.')
