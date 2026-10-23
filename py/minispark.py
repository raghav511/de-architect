"""minispark: a small PySpark-compatible DataFrame API on top of DuckDB.

Runs inside the browser (Pyodide). It turns DataFrame calls into SQL and runs
them on DuckDB, so PySpark practice code runs for real on sample tables.
It covers the common interview subset of pyspark.sql; anything missing raises
a clear NotImplementedError instead of guessing.
"""
import duckdb, itertools, re

_con = None
_ids = itertools.count(1)


def _sql(q):
    try:
        return _con.sql(q)
    except duckdb.BinderException:
        # Spark lets you refer to df.col after further transformations; drop stale qualifiers and retry
        return _con.sql(re.sub(r'"t\d+(_r)?"\.', '', q))


def _q(name):
    return '"' + str(name).replace('"', '""') + '"'


def _lit_sql(v):
    if v is None:
        return 'NULL'
    if isinstance(v, bool):
        return 'TRUE' if v else 'FALSE'
    if isinstance(v, (int, float)):
        return repr(v)
    return "'" + str(v).replace("'", "''") + "'"


class Column:
    def __init__(self, sql, name=None, agg=False, order=None):
        self.sql, self._name, self.agg, self.order = sql, name, agg, order

    # naming
    def alias(self, n):
        return Column(self.sql, n, self.agg)
    name = alias

    def _alias_name(self):
        return self._name

    # helpers
    def _bin(self, op, o, rev=False):
        o = _c(o, literal=True)
        a, b = (o.sql, self.sql) if rev else (self.sql, o.sql)
        return Column('(' + a + ' ' + op + ' ' + b + ')', agg=self.agg or o.agg)

    def __eq__(self, o):
        return self._bin('=', o)

    def __ne__(self, o):
        return self._bin('<>', o)

    def __lt__(self, o): return self._bin('<', o)
    def __le__(self, o): return self._bin('<=', o)
    def __gt__(self, o): return self._bin('>', o)
    def __ge__(self, o): return self._bin('>=', o)
    def __add__(self, o): return self._bin('+', o)
    def __radd__(self, o): return self._bin('+', o, True)
    def __sub__(self, o): return self._bin('-', o)
    def __rsub__(self, o): return self._bin('-', o, True)
    def __mul__(self, o): return self._bin('*', o)
    def __rmul__(self, o): return self._bin('*', o, True)
    def __truediv__(self, o): return self._bin('/', o)
    def __rtruediv__(self, o): return self._bin('/', o, True)
    def __mod__(self, o): return self._bin('%', o)
    def __and__(self, o): return self._bin('AND', o)
    def __or__(self, o): return self._bin('OR', o)
    def __invert__(self): return Column('(NOT ' + self.sql + ')', agg=self.agg)
    def __neg__(self): return Column('(-' + self.sql + ')', agg=self.agg)
    def __hash__(self): return id(self)

    def __bool__(self):
        raise ValueError("Use & and | (with brackets) to combine conditions, not 'and' / 'or'.")

    def isNull(self): return Column('(' + self.sql + ' IS NULL)')
    def isNotNull(self): return Column('(' + self.sql + ' IS NOT NULL)')

    def isin(self, *vals):
        if len(vals) == 1 and isinstance(vals[0], (list, tuple, set)):
            vals = list(vals[0])
        return Column('(' + self.sql + ' IN (' + ', '.join(_lit_sql(v) for v in vals) + '))')

    def between(self, a, b):
        return Column('(' + self.sql + ' BETWEEN ' + _c(a, True).sql + ' AND ' + _c(b, True).sql + ')')

    def like(self, p): return Column('(' + self.sql + ' LIKE ' + _lit_sql(p) + ')')
    def contains(self, s): return Column('(contains(' + self.sql + ', ' + _lit_sql(s) + '))')
    def startswith(self, s): return Column('(starts_with(' + self.sql + ', ' + _lit_sql(s) + '))')

    def cast(self, t):
        t = t if isinstance(t, str) else getattr(t, 'simpleString', lambda: str(t))()
        m = {'int': 'INTEGER', 'integer': 'INTEGER', 'long': 'BIGINT', 'bigint': 'BIGINT', 'double': 'DOUBLE', 'float': 'DOUBLE',
             'string': 'VARCHAR', 'date': 'DATE', 'timestamp': 'TIMESTAMP', 'boolean': 'BOOLEAN'}
        return Column('CAST(' + self.sql + ' AS ' + m.get(t.lower(), t) + ')', agg=self.agg)
    astype = cast

    def desc(self): return Column(self.sql, self._name, self.agg, 'DESC')
    def asc(self): return Column(self.sql, self._name, self.agg, 'ASC')
    def desc_nulls_last(self): return Column(self.sql, self._name, self.agg, 'DESC NULLS LAST')
    def asc_nulls_first(self): return Column(self.sql, self._name, self.agg, 'ASC NULLS FIRST')

    def otherwise(self, v):
        if not self.sql.startswith('CASE') or not self.sql.endswith(' END'):
            raise ValueError('otherwise() must follow when()')
        return Column(self.sql[:-4] + ' ELSE ' + _c(v, True).sql + ' END', agg=self.agg)

    def when(self, cond, v):
        if not self.sql.endswith(' END'):
            raise ValueError('when() chain must start with F.when()')
        return Column(self.sql[:-4] + ' WHEN ' + cond.sql + ' THEN ' + _c(v, True).sql + ' END', agg=self.agg)

    def over(self, w):
        return Column(self.sql + ' OVER (' + w._sql() + ')')

    def __repr__(self):
        return 'Column<' + self.sql + '>'


def _c(x, literal=False):
    if isinstance(x, Column):
        return x
    if isinstance(x, str) and not literal:
        return col(x)
    return Column(_lit_sql(x))


def col(name):
    if name == '*':
        return Column('*')
    parts = name.split('.')
    return Column('.'.join(_q(p) for p in parts), parts[-1])
column = col


def lit(v): return Column(_lit_sql(v))
def expr(s): return Column(s)


class _Window:
    def __init__(self, parts=(), orders=(), frame=None):
        self.parts, self.orders, self.frame = list(parts), list(orders), frame

    def partitionBy(self, *cols):
        return _Window([_c(c) for c in _flat(cols)], self.orders, self.frame)

    def orderBy(self, *cols):
        return _Window(self.parts, [_c(c) for c in _flat(cols)], self.frame)

    def rowsBetween(self, a, b):
        return _Window(self.parts, self.orders, ('ROWS', a, b))

    def rangeBetween(self, a, b):
        return _Window(self.parts, self.orders, ('RANGE', a, b))

    def _sql(self):
        s = []
        if self.parts:
            s.append('PARTITION BY ' + ', '.join(c.sql for c in self.parts))
        if self.orders:
            s.append('ORDER BY ' + ', '.join(c.sql + (' ' + c.order if c.order else '') for c in self.orders))
        if self.frame:
            kind, a, b = self.frame

            def b2s(v, side):
                if v <= -(1 << 62): return 'UNBOUNDED PRECEDING'
                if v >= (1 << 62): return 'UNBOUNDED FOLLOWING'
                if v == 0: return 'CURRENT ROW'
                return (str(-v) + ' PRECEDING') if v < 0 else (str(v) + ' FOLLOWING')
            s.append(kind + ' BETWEEN ' + b2s(a, 0) + ' AND ' + b2s(b, 1))
        return ' '.join(s)


class Window:
    unboundedPreceding = -(1 << 63)
    unboundedFollowing = (1 << 63)
    currentRow = 0

    @staticmethod
    def partitionBy(*cols): return _Window().partitionBy(*cols)

    @staticmethod
    def orderBy(*cols): return _Window().orderBy(*cols)


def _flat(cols):
    out = []
    for c in cols:
        if isinstance(c, (list, tuple)):
            out.extend(c)
        else:
            out.append(c)
    return out


class _F:
    """pyspark.sql.functions"""
    col = staticmethod(col); column = staticmethod(col); lit = staticmethod(lit); expr = staticmethod(expr)

    @staticmethod
    def _agg(fn, c, distinct=False):
        c = _c(c)
        return Column(fn + '(' + ('DISTINCT ' if distinct else '') + c.sql + ')', agg=True)

    def sum(self, c): return self._agg('sum', c)
    def avg(self, c): return self._agg('avg', c)
    mean = avg
    def min(self, c): return self._agg('min', c)
    def max(self, c): return self._agg('max', c)
    def first(self, c, ignorenulls=False): return self._agg('first', c)
    def last(self, c, ignorenulls=False): return self._agg('last', c)
    def stddev(self, c): return self._agg('stddev_samp', c)
    def collect_list(self, c): return self._agg('list', c)
    def collect_set(self, c): return Column('list(DISTINCT ' + _c(c).sql + ')', agg=True)
    def sumDistinct(self, c): return self._agg('sum', c, True)

    def count(self, c):
        if isinstance(c, str) and c == '*':
            return Column('count(*)', agg=True)
        return self._agg('count', c)

    def countDistinct(self, *cs):
        if len(cs) == 1:
            return self._agg('count', cs[0], True)
        return Column('count(DISTINCT (' + ', '.join(_c(c).sql for c in cs) + '))', agg=True)
    count_distinct = countDistinct

    def approx_count_distinct(self, c, rsd=None): return self._agg('approx_count_distinct', c)

    def when(self, cond, v): return Column('CASE WHEN ' + cond.sql + ' THEN ' + _c(v, True).sql + ' END', agg=cond.agg)

    def coalesce(self, *cs): return Column('coalesce(' + ', '.join(_c(c).sql for c in cs) + ')')
    def isnull(self, c): return _c(c).isNull()
    def upper(self, c): return Column('upper(' + _c(c).sql + ')')
    def lower(self, c): return Column('lower(' + _c(c).sql + ')')
    def trim(self, c): return Column('trim(' + _c(c).sql + ')')
    def length(self, c): return Column('length(' + _c(c).sql + ')')
    def concat(self, *cs): return Column('concat(' + ', '.join(_c(c).sql for c in cs) + ')')
    def concat_ws(self, sep, *cs): return Column('concat_ws(' + _lit_sql(sep) + ', ' + ', '.join(_c(c).sql for c in cs) + ')')
    def round(self, c, n=0): return Column('round(' + _c(c).sql + ', ' + str(n) + ')', agg=_c(c).agg)
    def abs(self, c): return Column('abs(' + _c(c).sql + ')')
    def greatest(self, *cs): return Column('greatest(' + ', '.join(_c(c).sql for c in cs) + ')')
    def least(self, *cs): return Column('least(' + ', '.join(_c(c).sql for c in cs) + ')')
    def split(self, c, p): return Column('string_split_regex(' + _c(c).sql + ', ' + _lit_sql(p) + ')')
    def explode(self, c): return Column('unnest(' + _c(c).sql + ')')
    def size(self, c): return Column('len(' + _c(c).sql + ')')
    def regexp_extract(self, c, p, i): return Column('regexp_extract(' + _c(c).sql + ', ' + _lit_sql(p) + ', ' + str(i) + ')')
    def to_date(self, c, fmt=None): return Column('CAST(' + _c(c).sql + ' AS DATE)')
    def to_timestamp(self, c, fmt=None): return Column('CAST(' + _c(c).sql + ' AS TIMESTAMP)')
    def date_trunc(self, unit, c): return Column('date_trunc(' + _lit_sql(unit) + ', ' + _c(c).sql + ')')
    def hour(self, c): return Column('hour(' + _c(c).sql + ')')
    def dayofweek(self, c): return Column('(dayofweek(' + _c(c).sql + ') + 1)')
    def year(self, c): return Column('year(' + _c(c).sql + ')')
    def month(self, c): return Column('month(' + _c(c).sql + ')')
    def datediff(self, end, start): return Column('datediff(\'day\', ' + _c(start).sql + ', ' + _c(end).sql + ')')
    def date_add(self, c, n): return Column('(' + _c(c).sql + ' + INTERVAL ' + str(int(n)) + ' DAY)')
    def date_sub(self, c, n): return Column('(' + _c(c).sql + ' - INTERVAL ' + str(int(n)) + ' DAY)')
    def current_date(self): return Column('current_date')
    def unix_timestamp(self, c): return Column('epoch(' + _c(c).sql + ')')
    def broadcast(self, df): return df
    def row_number(self): return Column('row_number()')
    def rank(self): return Column('rank()')
    def dense_rank(self): return Column('dense_rank()')
    def percent_rank(self): return Column('percent_rank()')
    def ntile(self, n): return Column('ntile(' + str(n) + ')')
    def lag(self, c, n=1, default=None): return Column('lag(' + _c(c).sql + ', ' + str(n) + (', ' + _lit_sql(default) if default is not None else '') + ')')
    def lead(self, c, n=1, default=None): return Column('lead(' + _c(c).sql + ', ' + str(n) + (', ' + _lit_sql(default) if default is not None else '') + ')')
    def desc(self, c): return _c(c).desc()
    def asc(self, c): return _c(c).asc()
    def rand(self, seed=None): return Column('random()')
    def floor(self, c): return Column('floor(' + _c(c).sql + ')')
    def ceil(self, c): return Column('ceil(' + _c(c).sql + ')')
    def sha2(self, c, bits=256): return Column('sha256(CAST(' + _c(c).sql + ' AS VARCHAR))')
    def md5(self, c): return Column('md5(CAST(' + _c(c).sql + ' AS VARCHAR))')
    def monotonically_increasing_id(self): return Column('(row_number() OVER () - 1)')

    def __getattr__(self, n):
        raise NotImplementedError('F.' + n + ' is not in the practice engine yet. Try another way, or ask the coach.')


F = functions = _F()


class Row(tuple):
    def __new__(cls, values, names):
        r = tuple.__new__(cls, values)
        r._names = list(names)
        return r

    def __getattr__(self, n):
        if n.startswith('_'):
            raise AttributeError(n)
        try:
            return self[self._names.index(n)]
        except ValueError:
            raise AttributeError(n)

    def __getitem__(self, k):
        if isinstance(k, str):
            return tuple.__getitem__(self, self._names.index(k))
        return tuple.__getitem__(self, k)

    def asDict(self):
        return dict(zip(self._names, self))

    def __repr__(self):
        return 'Row(' + ', '.join(n + '=' + repr(v) for n, v in zip(self._names, self)) + ')'


class GroupedData:
    def __init__(self, df, keys):
        self.df, self.keys = df, keys

    def agg(self, *exprs):
        if len(exprs) == 1 and isinstance(exprs[0], dict):
            exprs = [getattr(F, fn)(c).alias(fn + '(' + c + ')') for c, fn in exprs[0].items()]
        sel = [k.sql + (' AS ' + _q(k._name) if k._name else '') for k in self.keys]
        for i, e in enumerate(_flat(exprs)):
            nm = e._name or re.sub(r'[^A-Za-z0-9_()]+', '', e.sql.replace('"', ''))[:60] or 'agg' + str(i)
            sel.append(e.sql + ' AS ' + _q(nm))
        gb = (' GROUP BY ' + ', '.join(k.sql for k in self.keys)) if self.keys else ''
        return self.df._derive('SELECT ' + ', '.join(sel) + ' FROM {src}' + gb, 'HashAggregate(keys=[' + ', '.join(k._name or k.sql for k in self.keys) + '])', shuffle=bool(self.keys))

    def count(self): return self.agg(Column('count(*)', 'count', True))
    def sum(self, *cs): return self.agg(*[F.sum(c).alias('sum(' + c + ')') for c in cs])
    def avg(self, *cs): return self.agg(*[F.avg(c).alias('avg(' + c + ')') for c in cs])
    mean = avg
    def max(self, *cs): return self.agg(*[F.max(c).alias('max(' + c + ')') for c in cs])
    def min(self, *cs): return self.agg(*[F.min(c).alias('min(' + c + ')') for c in cs])


class DataFrame:
    def __init__(self, sql, plan=None):
        self._sql = sql
        self._plan = plan or []
        self._name = 't' + str(next(_ids))

    # --- core
    def _derive(self, tmpl, step, shuffle=False):
        sub = '(' + self._sql + ') AS ' + self._name
        p = list(self._plan)
        if shuffle:
            p.append('Exchange hashpartitioning(200)')
        p.append(step)
        return DataFrame(tmpl.replace('{src}', sub), p)

    def _rel(self):
        return _sql(self._sql)

    @property
    def columns(self):
        return list(self._rel().columns)

    def __getitem__(self, k):
        if isinstance(k, str):
            return Column(_q(self._name) + '.' + _q(k), k)
        if isinstance(k, Column):
            return self.filter(k)
        raise TypeError(k)

    def __getattr__(self, n):
        if n.startswith('_'):
            raise AttributeError(n)
        if n in self.columns:
            return Column(_q(self._name) + '.' + _q(n), n)
        raise AttributeError("DataFrame has no column or method '" + n + "'")

    def alias(self, a):
        d = DataFrame(self._sql, self._plan)
        d._name = a
        return d

    # --- transformations
    def select(self, *cols):
        cs = [_c(c) for c in _flat(cols)]
        return self._derive('SELECT ' + ', '.join(c.sql + (' AS ' + _q(c._name) if c._name and c.sql != _q(c._name) else '') for c in cs) + ' FROM {src}', 'Project')

    def selectExpr(self, *exprs):
        return self._derive('SELECT ' + ', '.join(exprs) + ' FROM {src}', 'Project')

    def filter(self, cond):
        c = cond.sql if isinstance(cond, Column) else cond
        return self._derive('SELECT * FROM {src} WHERE ' + c, 'Filter ' + c.replace('"', ''))
    where = filter

    def withColumn(self, name, c):
        cols = self.columns
        c = _c(c, True)
        if name in cols:
            sel = ', '.join((c.sql + ' AS ' + _q(name)) if x == name else _q(x) for x in cols)
            return self._derive('SELECT ' + sel + ' FROM {src}', 'Project')
        return self._derive('SELECT *, ' + c.sql + ' AS ' + _q(name) + ' FROM {src}', 'Project')

    def withColumnRenamed(self, old, new):
        sel = ', '.join((_q(x) + ' AS ' + _q(new)) if x == old else _q(x) for x in self.columns)
        return self._derive('SELECT ' + sel + ' FROM {src}', 'Project')

    def drop(self, *names):
        names = set(n if isinstance(n, str) else n._name for n in names)
        keep = [x for x in self.columns if x not in names]
        return self._derive('SELECT ' + ', '.join(_q(x) for x in keep) + ' FROM {src}', 'Project')

    def groupBy(self, *cols):
        return GroupedData(self, [_c(c) for c in _flat(cols)])
    groupby = groupBy

    def agg(self, *exprs):
        return GroupedData(self, []).agg(*exprs)

    def orderBy(self, *cols, ascending=True):
        cs = [_c(c) for c in _flat(cols)]
        if isinstance(ascending, bool):
            ascending = [ascending] * len(cs)
        parts = []
        for c, a in zip(cs, ascending):
            parts.append(c.sql + ' ' + (c.order or ('ASC' if a else 'DESC')))
        return self._derive('SELECT * FROM {src} ORDER BY ' + ', '.join(parts), 'Sort', shuffle=True)
    sort = orderBy

    def limit(self, n):
        return self._derive('SELECT * FROM {src} LIMIT ' + str(int(n)), 'CollectLimit ' + str(n))

    def distinct(self):
        return self._derive('SELECT DISTINCT * FROM {src}', 'HashAggregate(distinct)', shuffle=True)

    def dropDuplicates(self, subset=None):
        if not subset:
            return self.distinct()
        part = ', '.join(_q(s) for s in subset)
        return self._derive('SELECT * EXCLUDE (__rn) FROM (SELECT *, row_number() OVER (PARTITION BY ' + part + ') AS __rn FROM {src}) WHERE __rn = 1', 'Deduplicate [' + ', '.join(subset) + ']', shuffle=True)
    drop_duplicates = dropDuplicates

    def join(self, other, on=None, how='inner'):
        how = {'left_outer': 'left', 'leftouter': 'left', 'right_outer': 'right', 'outer': 'full', 'full_outer': 'full',
               'left_semi': 'semi', 'leftsemi': 'semi', 'left_anti': 'anti', 'leftanti': 'anti'}.get(how, how)
        a, b = self.alias(self._name), other
        if b._name == a._name:
            b = other.alias(other._name + '_r')
        L = '(' + self._sql + ') AS ' + a._name
        R = '(' + other._sql + ') AS ' + b._name
        kind = {'inner': 'JOIN', 'left': 'LEFT JOIN', 'right': 'RIGHT JOIN', 'full': 'FULL JOIN', 'cross': 'CROSS JOIN', 'semi': 'SEMI JOIN', 'anti': 'ANTI JOIN'}[how]
        plan = self._plan + ['  + ' + s for s in other._plan] + ['SortMergeJoin ' + how + ' ' + str(on)]
        if on is None:
            return DataFrame('SELECT * FROM ' + L + ' ' + kind + ' ' + R, plan)
        if isinstance(on, str):
            on = [on]
        if isinstance(on, (list, tuple)) and all(isinstance(x, str) for x in on):
            sel = 'SELECT *' if how in ('semi', 'anti') else 'SELECT *'
            return DataFrame(sel + ' FROM ' + L + ' ' + kind + ' ' + R + ' USING (' + ', '.join(_q(x) for x in on) + ')', plan)
        cond = on if isinstance(on, Column) else _flat(on)[0]
        if isinstance(on, (list, tuple)):
            cond = on[0]
            for x in on[1:]:
                cond = cond & x
        la, rb = 'j' + a._name[1:], 'j' + b._name[1:] + 'r'
        sql = cond.sql.replace('"' + a._name + '".', '"' + la + '".').replace('"' + other._name + '".', '"' + rb + '".')
        L = '(' + self._sql + ') AS ' + _q(la)
        R = '(' + other._sql + ') AS ' + _q(rb)
        if how in ('semi', 'anti'):
            sel = _q(la) + '.*'
        else:
            lc = self.columns
            rc = [c for c in other.columns if c not in lc]
            sel = ', '.join([_q(la) + '.*'] + [_q(rb) + '.' + _q(c) for c in rc])
        return DataFrame('SELECT ' + sel + ' FROM ' + L + ' ' + kind + ' ' + R + ' ON ' + sql, plan)

    def crossJoin(self, other):
        return self.join(other, None, 'cross')

    def union(self, other):
        return DataFrame('(' + self._sql + ') UNION ALL (' + other._sql + ')', self._plan + ['Union'])
    unionAll = union

    def unionByName(self, other, allowMissingColumns=False):
        return DataFrame('(' + self._sql + ') UNION ALL BY NAME (' + other._sql + ')', self._plan + ['Union'])

    def subtract(self, other):
        return DataFrame('(' + self._sql + ') EXCEPT (' + other._sql + ')', self._plan + ['Except'])

    def fillna(self, value, subset=None):
        cols = self.columns
        tgt = subset or cols
        if isinstance(value, dict):
            sel = ', '.join(('coalesce(' + _q(x) + ', ' + _lit_sql(value[x]) + ') AS ' + _q(x)) if x in value else _q(x) for x in cols)
        else:
            sel = ', '.join(('coalesce(' + _q(x) + ', ' + _lit_sql(value) + ') AS ' + _q(x)) if x in tgt else _q(x) for x in cols)
        return self._derive('SELECT ' + sel + ' FROM {src}', 'Project')

    def dropna(self, subset=None):
        tgt = subset or self.columns
        return self.filter(' AND '.join(_q(x) + ' IS NOT NULL' for x in tgt))

    # no-ops that matter in real Spark
    def repartition(self, *a, **k): return self._noop('Exchange RoundRobinPartitioning')
    def coalesce(self, n): return self._noop('Coalesce ' + str(n))
    def cache(self): return self._noop('InMemoryRelation')
    persist = cache
    def unpersist(self): return self
    def hint(self, *a): return self

    def _noop(self, step):
        d = DataFrame(self._sql, self._plan + [step])
        return d

    # --- actions
    def collect(self):
        rel = self._rel()
        names = rel.columns
        return [Row(r, names) for r in rel.fetchall()]

    def count(self):
        return _sql('SELECT count(*) FROM (' + self._sql + ')').fetchone()[0]

    def first(self):
        r = self.limit(1).collect()
        return r[0] if r else None

    def head(self, n=None):
        return self.first() if n is None else self.limit(n).collect()

    def take(self, n): return self.limit(n).collect()

    def toPandas(self):
        return self._rel().df()

    def show(self, n=20, truncate=True):
        rel = self._rel()
        names = rel.columns
        rows = _sql('SELECT * FROM (' + self._sql + ') LIMIT ' + str(n + 1)).fetchall()
        more = len(rows) > n
        rows = rows[:n]

        def fmt(v):
            s = 'null' if v is None else str(v)
            return s[:20] if truncate and len(s) > 20 else s
        cells = [[fmt(v) for v in r] for r in rows]
        w = [max([len(h)] + [len(r[i]) for r in cells]) for i, h in enumerate(names)]
        line = '+' + '+'.join('-' * x for x in w) + '+'
        out = [line, '|' + '|'.join(h.rjust(w[i]) for i, h in enumerate(names)) + '|', line]
        out += ['|' + '|'.join(c.rjust(w[i]) for i, c in enumerate(r)) + '|' for r in cells]
        out.append(line)
        if more:
            out.append('only showing top ' + str(n) + ' rows')
        print('\n'.join(out))

    def printSchema(self):
        rel = self._rel()
        print('root')
        for n, t in zip(rel.columns, rel.types):
            print(' |-- ' + n + ': ' + str(t).lower())

    def explain(self, mode=None):
        steps = list(reversed(self._plan)) or ['Scan']
        print('== Physical Plan ==')
        for i, s in enumerate(steps):
            print(('   ' * i) + ('+- ' if i else '') + s)
        print('(practice engine: plan shape only; sizes and timings are from recorded real runs)')

    def createOrReplaceTempView(self, name):
        _con.execute('CREATE OR REPLACE TEMP VIEW ' + _q(name) + ' AS ' + self._sql)

    @property
    def write(self):
        return _Writer(self)

    @property
    def rdd(self):
        raise NotImplementedError('RDDs are not in the practice engine. Use DataFrames; interviews expect them.')

    def __repr__(self):
        rel = self._rel()
        return 'DataFrame[' + ', '.join(n + ': ' + str(t).lower() for n, t in zip(rel.columns, rel.types)) + ']'


class _Writer:
    def __init__(self, df):
        self.df, self._mode = df, 'error'

    def mode(self, m):
        self._mode = m
        return self

    def partitionBy(self, *c): return self
    def format(self, f): return self
    def option(self, *a): return self

    def _save(self, path):
        name = _table_from_path(path)
        _con.execute('CREATE OR REPLACE TABLE ' + _q(name) + ' AS ' + self.df._sql)
        print('Wrote ' + str(self.df.count()) + ' rows to ' + path + ' (saved as table ' + name + ')')
    parquet = save = saveAsTable = insertInto = _save

    def json(self, path): self._save(path)
    def csv(self, path, header=True): self._save(path)


def _table_from_path(path):
    p = str(path).rstrip('/').split('/')[-1]
    p = re.sub(r'\.(parquet|csv|json)$', '', p)
    return re.sub(r'[^A-Za-z0-9_]', '_', p)


class _Reader:
    def option(self, *a): return self
    def format(self, f): return self
    def schema(self, s): return self

    def _load(self, path, *a, **k):
        return SparkSession._inst.table(_table_from_path(path))
    parquet = load = json = csv = table = _load


class _Conf:
    def __init__(self): self.d = {}
    def set(self, k, v): self.d[k] = v
    def get(self, k, default=None): return self.d.get(k, default)


class SparkSession:
    _inst = None

    class Builder:
        def appName(self, n): return self
        def master(self, m): return self
        def config(self, *a, **k): return self
        def enableHiveSupport(self): return self

        def getOrCreate(self):
            if SparkSession._inst is None:
                SparkSession._inst = SparkSession()
            return SparkSession._inst

    builder = Builder()

    def __init__(self):
        self.conf = _Conf()
        self.read = _Reader()

    def table(self, name):
        _con.sql('SELECT * FROM ' + _q(name) + ' LIMIT 0')
        return DataFrame('SELECT * FROM ' + _q(name), ['FileScan parquet ' + name])

    def sql(self, q):
        return DataFrame(q, ['SQL'])

    def createDataFrame(self, data, schema=None):
        if hasattr(data, 'columns') and hasattr(data, 'to_dict'):
            n = '__df' + str(next(_ids))
            _con.register(n, data)
            return DataFrame('SELECT * FROM ' + n, ['LocalTableScan'])
        rows = list(data)
        if schema is None:
            if rows and isinstance(rows[0], dict):
                schema = list(rows[0].keys())
                rows = [tuple(r[k] for k in schema) for r in rows]
            else:
                schema = ['_' + str(i + 1) for i in range(len(rows[0]))]
        if isinstance(schema, str):
            schema = [s.strip().split(' ')[0].split(':')[0] for s in schema.split(',')]
        if not rows:
            raise ValueError('createDataFrame needs at least one row in the practice engine')
        vals = ', '.join('(' + ', '.join(_lit_sql(v) for v in r) + ')' for r in rows)
        return DataFrame('SELECT * FROM (VALUES ' + vals + ') AS v(' + ', '.join(_q(s) for s in schema) + ')', ['LocalTableScan'])

    def range(self, a, b=None, step=1):
        if b is None:
            a, b = 0, a
        return DataFrame('SELECT range AS id FROM range(' + str(a) + ', ' + str(b) + ', ' + str(step) + ')', ['Range'])

    def stop(self): pass


def install(con):
    """Make `pyspark` imports work and expose spark/F in the user's namespace."""
    global _con
    _con = con
    import sys, types
    pkg = types.ModuleType('pyspark')
    sqlm = types.ModuleType('pyspark.sql')
    fm = types.ModuleType('pyspark.sql.functions')
    wm = types.ModuleType('pyspark.sql.window')
    tm = types.ModuleType('pyspark.sql.types')
    for n in dir(F.__class__):
        if not n.startswith('_'):
            setattr(fm, n, getattr(F, n))
    fm.col, fm.lit, fm.expr = col, lit, expr
    wm.Window = Window
    sqlm.SparkSession, sqlm.DataFrame, sqlm.Row, sqlm.Window, sqlm.functions, sqlm.Column = SparkSession, DataFrame, Row, Window, fm, Column
    for t in ['StringType', 'IntegerType', 'LongType', 'DoubleType', 'DateType', 'TimestampType', 'BooleanType']:
        setattr(tm, t, type(t, (), {'simpleString': (lambda self, t=t: t.replace('Type', '').lower().replace('integer', 'int'))}))
    tm.StructType = lambda fields=None: fields
    tm.StructField = lambda name, t=None, nullable=True: name
    pkg.sql = sqlm
    sys.modules.update({'pyspark': pkg, 'pyspark.sql': sqlm, 'pyspark.sql.functions': fm, 'pyspark.sql.window': wm, 'pyspark.sql.types': tm})
    return SparkSession.builder.getOrCreate()
